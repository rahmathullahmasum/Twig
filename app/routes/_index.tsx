import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { isAuthed } from "../lib/auth/session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  throw redirect((await isAuthed(request)) ? "/dashboard" : "/login");
};
