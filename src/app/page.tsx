import App from '@/components/App';
export const dynamic='force-dynamic';

export default async function Page({searchParams}: PageProps<'/'>) {
  const params = await searchParams;
  return <App accountDeletion={params['delete-account'] === '1'}/>;
}
