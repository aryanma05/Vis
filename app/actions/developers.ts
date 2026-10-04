"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { requireUserForAction } from "@/lib/session";
import { createWebhook, deleteWebhook, sendTestWebhook } from "@/lib/webhooks";

export async function createApiKeyAction(name: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const key = await createApiKey(user.id, String(name ?? ""));
    revalidatePath("/profil/rediger/konto");
    return { key };
  }, "api.key-create");
}

export async function revokeApiKeyAction(id: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await revokeApiKey(user.id, String(id));
    revalidatePath("/profil/rediger/konto");
  }, "api.key-revoke");
}

export async function createWebhookAction(companyId: string, input: { url: string; events: string[] }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return createWebhook(user.id, String(companyId), { url: String(input?.url ?? ""), events: Array.isArray(input?.events) ? input.events.map(String) : [] });
  }, "webhook.create");
}

export async function deleteWebhookAction(webhookId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteWebhook(user.id, String(webhookId));
  }, "webhook.delete");
}

export async function testWebhookAction(webhookId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return sendTestWebhook(user.id, String(webhookId));
  }, "webhook.test");
}
