import type { LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import { AppProvider, Layout, Card, Text, BlockStack, Badge, InlineStack } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { requireAuth } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const currentUserId = await requireAuth(request);
  const user = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, createdAt: true, updatedAt: true },
  });
  if (!user) {
    throw data("User not found", { status: 404 });
  }
  return { user, isYou: user.id === currentUserId };
};

export default function UserInfo() {
  const { user, isYou } = useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={polarisTranslations}>
      <AppLayout title={user.email} subtitle="Account details">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    {user.email}
                  </Text>
                  {isYou && <Badge tone="info">You</Badge>}
                </InlineStack>
                <BlockStack gap="100">
                  <Text as="p" tone="subdued">
                    Joined {formatRelativeTime(user.createdAt)}
                  </Text>
                  <Text as="p" tone="subdued">
                    Password last changed {formatRelativeTime(user.updatedAt)}
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </AppLayout>
    </AppProvider>
  );
}
