import type { Metadata } from "next";
import { ExportClient } from "./ExportClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ExportPage() {
  return <ExportClient />;
}
