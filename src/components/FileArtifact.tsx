import { FileText, ArrowRight } from 'lucide-react';

interface FileArtifactProps {
  path: string;
  title?: string;
  onClick?: () => void;
}

export function FileArtifact({ path, title, onClick }: FileArtifactProps) {
  const displayTitle = title || path.split('/').pop()?.replace('.md', '') || 'Untitled Note';
  
  return (
    <div 
      onClick={onClick}
      className="group flex items-center gap-4 p-4 my-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-900 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-center size-12 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
        <FileText size={24} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {displayTitle}
        </h4>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate font-mono">
          {path}
        </p>
      </div>

      <div className="flex items-center justify-center size-8 rounded-full text-zinc-400 group-hover:text-purple-600 group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 transition-colors">
        <ArrowRight size={18} />
      </div>
    </div>
  );
}
