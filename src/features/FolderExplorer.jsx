import React from 'react';
import { Folder, ChevronRight, File, Info } from 'lucide-react';

/**
 * Componente de Exploração de Pastas do Sinistro
 */
const FolderExplorer = ({ folders, selectedId, onSelect, isAdminOrInternal }) => {
    return (
        <div className="space-y-2">
            {folders.map(folder => (
                <button
                    key={folder.id}
                    onClick={() => onSelect(folder.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${selectedId === folder.id
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100'
                            : 'bg-white border-gray-100 hover:border-blue-200 text-gray-500 hover:text-blue-600'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <Folder size={20} className={selectedId === folder.id ? 'text-white' : 'text-blue-600'} />
                        <span className="font-bold text-sm">{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black ${selectedId === folder.id ? 'text-blue-100' : 'text-gray-400'}`}>
                            {folder.completion}%
                        </span>
                        <ChevronRight size={16} opacity={0.5} />
                    </div>
                </button>
            ))}
        </div>
    );
};

export default FolderExplorer;
