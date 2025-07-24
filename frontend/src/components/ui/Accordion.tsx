'use client';

import React, { useState } from 'react';

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`win98-accordion-section ${className}`}>
      <div 
        className="win98-accordion-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="win98-accordion-icon">
          {isExpanded ? '−' : '+'}
        </span>
        <span className="win98-accordion-title">{title}</span>
      </div>
      {isExpanded && (
        <div className="win98-accordion-content">
          {children}
        </div>
      )}
    </div>
  );
};

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`win98-accordion ${className}`}>
      {children}
    </div>
  );
};

export default Accordion;
