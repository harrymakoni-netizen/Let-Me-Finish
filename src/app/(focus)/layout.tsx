import { FocusShell } from "@/components/app-shell";

export default function FocusLayout({ children }: LayoutProps<"/">) {
  return <FocusShell>{children}</FocusShell>;
}
