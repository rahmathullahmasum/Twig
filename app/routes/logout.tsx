import type { ActionFunctionArgs } from "react-router";
import { destroySession } from "../lib/auth/session.server";

export const action = async ({ request }: ActionFunctionArgs) => destroySession(request);
