import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import AssistantChat from './assistant-chat';
export default async function AIPage(){const user=await currentUser();if(!['clinic_admin','receptionist','dentist'].includes(user?.role))redirect('/dashboard');return <AssistantChat role={user.role}/>}
