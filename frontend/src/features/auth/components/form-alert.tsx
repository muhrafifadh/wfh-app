import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormAlert({
  message,
  variant = "destructive",
}: {
  message: string | undefined;
  variant?: "default" | "destructive";
}) {
  if (!message) return null;
  return (
    <Alert variant={variant}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
