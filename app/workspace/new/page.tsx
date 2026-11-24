import Studio from '../../studio';
import {requireWorkspaceUser} from '../../auth';
export const dynamic='force-dynamic';
export default async function NewArticle(){await requireWorkspaceUser();return <Studio initialView="workspace" startNew/>;}
