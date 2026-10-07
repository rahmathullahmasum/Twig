import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { AppProvider, Layout, Card, DataTable, Badge, InlineStack } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { requireAuth } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentUserId = await requireAuth(request);
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, createdAt: true },
  });
  return { users, currentUserId };
};

export default function Users() {
  const { users, currentUserId } = useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={polarisTranslations}>
      <AppLayout title="Users" subtitle="Everyone with access to this dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <DataTable
                columnContentTypes={["text", "text"]}
                headings={["Email", "Joined"]}
                rows={users.map((u) => [
                  <InlineStack key={u.id} gap="200" blockAlign="center">
                    <Link to={`/users/${u.id}`}>{u.email}</Link>
                    {u.id === currentUserId && <Badge tone="info">You</Badge>}
                  </InlineStack>,
                  formatRelativeTime(u.createdAt),
                ])}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </AppLayout>
    </AppProvider>
  );
}
