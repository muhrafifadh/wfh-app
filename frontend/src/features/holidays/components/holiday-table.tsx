import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddHolidayButton } from "@/features/holidays/components/add-holiday-button";
import { HolidayRowActions } from "@/features/holidays/components/holiday-row-actions";
import { listHolidays } from "@/features/holidays/queries";
import { formatDayDate } from "@/lib/format";

export async function HolidayTable({ year, today }: { year: number; today: string }) {
  const holidays = await listHolidays(year);

  if (holidays.length === 0) {
    return (
      <EmptyState
        title={`No holidays in ${year}`}
        description="Weekends are already non-working days. Add public holidays and company days off."
        action={
          <AddHolidayButton
            today={today}
            defaultDate={today.startsWith(String(year)) ? today : `${year}-01-01`}
            label="Add a holiday"
          />
        }
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Date</TableHead>
            <TableHead scope="col">Name</TableHead>
            <TableHead scope="col" className="hidden md:table-cell">
              Added by
            </TableHead>
            <TableHead scope="col" className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holidays.map((holiday) => (
            <TableRow key={holiday.id}>
              <TableCell className="whitespace-nowrap">
                {formatDayDate(holiday.date)}
                {holiday.date < today && (
                  <span className="block text-xs text-muted-foreground">Past</span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">{holiday.name}</TableCell>
              <TableCell className="hidden md:table-cell">{holiday.createdBy.name}</TableCell>
              <TableCell className="px-1">
                <HolidayRowActions holiday={holiday} today={today} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
