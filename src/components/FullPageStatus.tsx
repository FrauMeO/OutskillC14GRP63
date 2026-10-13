export default function FullPageStatus({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center" role="status">
      <p className="text-moss">{message}</p>
    </div>
  );
}
