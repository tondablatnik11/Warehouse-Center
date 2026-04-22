// src/components/shared/SectionHeader.jsx
'use client';
import React from 'react';

export default function SectionHeader({ title, description, icon: Icon }) {
  return (
    <div className="section-header flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-blue-400 flex-shrink-0" />}
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
