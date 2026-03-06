import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Vibra Code | AI Mobile App Builder",
  description: "Build stunning mobile apps with AI in minutes. Create iOS and Android apps instantly.",
};

export default function Home() {
  return <ClientPage />;
}
