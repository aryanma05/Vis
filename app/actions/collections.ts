"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import {
  createCollection,
  deleteCollection,
  listOwnCollections,
  setCollectionItem,
  updateCollection,
  type CollectionInput,
} from "@/lib/collections";
import { requireUserForAction } from "@/lib/session";

const input = (v: Partial<CollectionInput> | undefined): CollectionInput => ({
  title: String(v?.title ?? ""),
  description: v?.description ? String(v.description) : null,
  isPublic: Boolean(v?.isPublic),
});

export async function listMyCollectionsAction(projectId?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return listOwnCollections(user.id, projectId ? String(projectId) : null);
  });
}

// Lager en samling, og legger eventuelt prosjektet rett inn i den.
export async function createCollectionAction(values: Partial<CollectionInput>, projectId?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const id = await createCollection(user.id, input(values));
    if (projectId) await setCollectionItem(user.id, id, String(projectId), true);
    revalidatePath(`/profil/${user.username}`);
    return { id };
  }, "collection.create");
}

export async function updateCollectionAction(id: string, values: Partial<CollectionInput>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await updateCollection(user.id, String(id), input(values));
    revalidatePath(`/samling/${id}`);
    revalidatePath(`/profil/${user.username}`);
  }, "collection.update");
}

export async function deleteCollectionAction(id: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteCollection(user.id, String(id));
    revalidatePath(`/profil/${user.username}`);
  }, "collection.delete");
}

export async function setCollectionItemAction(collectionId: string, projectId: string, on: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setCollectionItem(user.id, String(collectionId), String(projectId), Boolean(on));
    revalidatePath(`/samling/${collectionId}`);
  }, "collection.item");
}
