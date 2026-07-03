import React from 'react';

// Shimmering placeholder shown while page data loads.
const PageSkeleton = ({ blocks = 4 }) => (
  <div className="min-h-screen bg-dh-bg px-4 pt-6">
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-44 bg-dh-card rounded-xl animate-pulse" />
        <div className="h-8 w-20 bg-dh-card rounded-xl animate-pulse" />
      </div>
      {Array.from({ length: blocks }).map((_, i) => (
        <div
          key={i}
          className="h-24 bg-dh-card rounded-2xl animate-pulse mb-4"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  </div>
);

export default PageSkeleton;
