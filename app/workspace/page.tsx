import Studio from '../studio';
import {requireWorkspaceUser} from '../auth';
export const dynamic='force-dynamic';
export default async function Workspace(){await requireWorkspaceUser();return <Studio/>;}
