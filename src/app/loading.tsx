interface LoadingProps {
  username?: string;
}

export default function Loading({ username }: LoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
} 