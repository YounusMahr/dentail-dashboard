import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import AssistantChat from './assistant-chat';
export default async function AIPage(){const user=await currentUser();if(user?.role!=='clinic_admin')redirect('/dashboard');return <AssistantChat/>}
