// docs/18-tooling-and-git.md — Conventional Commits
// Commits are authored by people: no AI tool (Claude, Anthropic) as co-author.
const AI_CO_AUTHOR = /^co-authored-by:.*(claude|anthropic)/im;

const config = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "no-ai-co-author": ({ raw }) => [
          !AI_CO_AUTHOR.test(raw ?? ""),
          "remove the Co-Authored-By trailer for Claude/Anthropic",
        ],
      },
    },
  ],
  rules: { "no-ai-co-author": [2, "always"] },
};

export default config;
