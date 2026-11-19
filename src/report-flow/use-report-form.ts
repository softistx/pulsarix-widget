import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import type { Messages } from "../messages";
import { type ReportValues, resolverFor } from "../validation";

/**
 * The report form. Its starting values are the kept draft, else the prefill; every keystroke
 * lands in the draft (the dialog's owner keeps it across a close), which the confirmation clears.
 */
export function useReportForm({
  messages,
  draft,
  prefill,
}: {
  messages: Messages;
  draft?: { current: ReportValues | null };
  prefill?: { email: string; title: string };
}) {
  const resolver = useMemo(() => resolverFor(messages.errors), [messages]);
  const form = useForm<ReportValues>({
    defaultValues: draft?.current ?? {
      title: prefill?.title ?? "",
      description: "",
      email: prefill?.email ?? "",
      type: "",
      impact: "",
    },
    resolver,
  });
  const { watch } = form;
  useEffect(() => {
    if (!draft) return;
    const subscription = watch((values) => {
      draft.current = {
        title: values.title ?? "",
        description: values.description ?? "",
        email: values.email ?? "",
        type: values.type ?? "",
        impact: values.impact ?? "",
      };
    });
    return () => subscription.unsubscribe();
  }, [draft, watch]);
  return form;
}
