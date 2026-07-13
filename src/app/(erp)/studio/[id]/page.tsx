import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { getDefaultOrgId } from "@/server/org";
import { getStudioProject } from "@/server/repositories/studio";
import { EditorClient } from "@/components/studio/EditorClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "디자인 편집" };

export default async function StudioEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = await getDefaultOrgId();
  const project = await getStudioProject(orgId, id);
  if (!project) notFound();

  return <EditorClient projectId={project.id} initialTitle={project.title} initialDoc={project.doc} />;
}
