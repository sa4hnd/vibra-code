import { Metadata } from "next";
import SessionsClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Sessions | Vibra Code",
  description: "Your app building sessions",
};

export default async function SessionsPage() {
  return <SessionsClientPage />;
}
