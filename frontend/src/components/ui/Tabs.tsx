'use client';

import React, { useState } from 'react';

interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={`win98-tabs ${className}`}>
      {/* Tab Headers */}
      <div className="win98-tab-headers">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            className={`win98-tab-header ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              zIndex: activeTab === tab.id ? 10 : index + 1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="win98-tab-content">
        {activeTabContent}
      </div>
    </div>
  );
};

interface StatusIconProps {
  status: 'good' | 'warning' | 'error';
  className?: string;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status, className = '' }) => {
  const getIcon = () => {
    switch (status) {
      case 'good':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✗';
      default:
        return '?';
    }
  };

  const getColor = () => {
    switch (status) {
      case 'good':
        return '#008000';
      case 'warning':
        return '#FFA500';
      case 'error':
        return '#FF0000';
      default:
        return '#808080';
    }
  };

  return (
    <span 
      className={`win98-status-icon ${className}`}
      style={{ color: getColor() }}
    >
      {getIcon()}
    </span>
  );
};

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export const QualityMeter: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  className = '',
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const getColor = () => {
    if (percentage >= 80) return '#008000';
    if (percentage >= 60) return '#FFA500';
    if (percentage >= 40) return '#FFFF00';
    return '#FF0000';
  };

  return (
    <div className={`win98-quality-meter ${className}`}>
      {label && <div className="win98-quality-label">{label}</div>}
      <div className="win98-quality-bar">
        <div 
          className="win98-quality-fill"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: getColor()
          }}
        />
      </div>
      <div className="win98-quality-text">{Math.round(percentage)}%</div>
    </div>
  );
};

export default Tabs;
