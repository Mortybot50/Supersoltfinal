import AcceptForm from "./ui/AcceptForm";

export default function AcceptPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) return <div className="p-6">Invalid invitation.</div>;
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Accept invitation</h1>
      <p className="text-sm text-muted-foreground">Set your password to join your team.</p>
      <AcceptForm token={searchParams.token} />
    </div>
  );
}
