import type { Metadata } from "next";
import { TemplatesClient } from "./TemplatesClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function TemplatesPage() {
  return <TemplatesClient />;
}
