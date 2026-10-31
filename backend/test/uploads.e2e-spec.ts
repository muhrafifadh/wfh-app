import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { StorageService } from "@/infra/storage/storage.service.js";
import { UploadsService } from "@/modules/uploads/uploads.service.js";

import { authHeader, createTestApp, createUser, resetDatabase, type TestUser } from "./helpers.js";

// Needs the storage container: docker compose up -d storage
describe("Uploads (e2e)", () => {
  let app: NestExpressApplication;
  let user: TestUser;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    user = await createUser(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const content = "name,amount\nAcme,125000\n";
  const start = async (as: TestUser = user, body: Record<string, unknown> = {}) =>
    http()
      .post("/v1/uploads")
      .set(await authHeader(app, as))
      .send({
        filename: "report.csv",
        contentType: "text/csv",
        size: Buffer.byteLength(content),
        ...body,
      });
  const put = (url: string, headers: Record<string, string>, body: string) =>
    fetch(url, { method: "PUT", headers, body });

  it("uploads straight to storage, then serves a download link", async () => {
    const created = await start();
    expect(created.status).toBe(201);
    expect(created.body.upload).toMatchObject({ status: "pending", downloadUrl: null });

    const putRes = await put(created.body.uploadUrl, created.body.uploadHeaders, content);
    expect(putRes.status).toBe(200);

    const completed = await http()
      .post(`/v1/uploads/${created.body.upload.id}/complete`)
      .set(await authHeader(app, user))
      .expect(200);
    expect(completed.body.status).toBe("ready");

    const download = await fetch(completed.body.downloadUrl);
    expect(await download.text()).toBe(content);
    expect(download.headers.get("content-disposition")).toContain("report.csv");
  });

  it("refuses to complete before the file arrives", async () => {
    const created = await start();
    const res = await http()
      .post(`/v1/uploads/${created.body.upload.id}/complete`)
      .set(await authHeader(app, user))
      .expect(409);
    expect(res.body.error.code).toBe("UPLOAD_NOT_RECEIVED");
  });

  it("rejects a file that doesn't match the signed size", async () => {
    const created = await start();
    const putRes = await put(created.body.uploadUrl, created.body.uploadHeaders, `${content}extra`);
    expect(putRes.ok).toBe(false);
  });

  it("deletes a file whose content doesn't match its type", async () => {
    const fake = "MZ\u0000\u0000not really a png";
    const created = await start(user, {
      filename: "photo.png",
      contentType: "image/png",
      size: Buffer.byteLength(fake),
    });
    await put(created.body.uploadUrl, created.body.uploadHeaders, fake);

    const res = await http()
      .post(`/v1/uploads/${created.body.upload.id}/complete`)
      .set(await authHeader(app, user))
      .expect(422);
    expect(res.body.error.code).toBe("UPLOAD_MISMATCH");
    const row = await app.get(PrismaService).upload.findUniqueOrThrow({
      where: { id: created.body.upload.id },
    });
    await expect(app.get(StorageService).head(row.key)).resolves.toBeNull();
  });

  it("validates type and size", async () => {
    const res = await start(user, { contentType: "application/x-msdownload", size: 0 });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["contentType", "size"]);
  });

  it("hides other organizations' uploads, and lets only the uploader complete or delete", async () => {
    const created = (await start()).body.upload;
    const colleague = await createUser(app, { sameOrganizationAs: user });
    const stranger = await createUser(app);

    await http()
      .get(`/v1/uploads/${created.id}`)
      .set(await authHeader(app, colleague))
      .expect(200);
    await http()
      .get(`/v1/uploads/${created.id}`)
      .set(await authHeader(app, stranger))
      .expect(404);
    await http()
      .delete(`/v1/uploads/${created.id}`)
      .set(await authHeader(app, colleague))
      .expect(404);

    await http()
      .delete(`/v1/uploads/${created.id}`)
      .set(await authHeader(app, user))
      .expect(204);
    await http()
      .get(`/v1/uploads/${created.id}`)
      .set(await authHeader(app, user))
      .expect(404);
  });

  it("purges abandoned uploads and their files", async () => {
    const created = await start();
    await put(created.body.uploadUrl, created.body.uploadHeaders, content);
    const prisma = app.get(PrismaService);
    const row = await prisma.upload.update({
      where: { id: created.body.upload.id },
      data: { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    });

    await expect(app.get(UploadsService).purgeExpired()).resolves.toBe(1);
    await expect(prisma.upload.count()).resolves.toBe(0);
    await expect(app.get(StorageService).head(row.key)).resolves.toBeNull();
  });

  it("lists the organization's completed uploads, newest first", async () => {
    const colleague = await createUser(app, { sameOrganizationAs: user });
    const finish = async (as: TestUser, filename: string) => {
      const created = await start(as, { filename });
      await put(created.body.uploadUrl, created.body.uploadHeaders, content);
      await http()
        .post(`/v1/uploads/${created.body.upload.id}/complete`)
        .set(await authHeader(app, as))
        .expect(200);
    };
    await finish(user, "first.csv");
    await finish(colleague, "second.csv");
    await start(user, { filename: "still-pending.csv" });
    await finish(await createUser(app), "other-org.csv");

    const res = await http()
      .get("/v1/uploads")
      .set(await authHeader(app, user))
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((u: { filename: string }) => u.filename)).toEqual([
      "second.csv",
      "first.csv",
    ]);
    expect(res.body.items[0]).toMatchObject({
      status: "ready",
      uploadedBy: { id: colleague.id },
      downloadUrl: expect.stringContaining("http"),
    });

    const search = await http()
      .get("/v1/uploads?q=FIRST")
      .set(await authHeader(app, user))
      .expect(200);
    expect(search.body.total).toBe(1);
  });

  it("requires a signed-in user", async () => {
    await http().post("/v1/uploads").send({}).expect(401);
  });
});
