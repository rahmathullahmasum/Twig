import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getUserId } from "../lib/auth/session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  throw redirect((await getUserId(request)) ? "/dashboard" : "/login");
};
