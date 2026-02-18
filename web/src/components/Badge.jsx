import React from 'react';

/**
 * Componente de Badge para Status e Categorias
 * @param {string} children - Conteúdo do badge
 * @param {string} colorClass - Classe de cor (Tailwind)
 * @param {string} variant - 'pill' ou 'square'
 */
const Badge = ({ children, colorClass, variant = 'pill' }) => {
    const baseStyles = "text-[10px] px-2.5 py-1 font-black uppercase tracking-widest ring-4 ring-opacity-10 transition-all";
    const variantStyles = variant === 'pill' ? "rounded-full" : "rounded-lg";

    return (
        <span className={`${baseStyles} ${variantStyles} ${colorClass}`}>
            {children}
        </span>
    );
};

export default Badge;
