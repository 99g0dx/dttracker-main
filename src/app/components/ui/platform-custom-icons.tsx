// Custom Premium Platform Icons
// Designed with 2px stroke width, clean monochrome style

import React from 'react';

interface PlatformIconProps {
  className?: string;
}

export const TikTokCustomIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M14 2V8.5C14 9.88 12.88 11 11.5 11C10.12 11 9 9.88 9 8.5M14 2C14 2 15.5 3 17 3V6C15.5 6 14 5 14 5M14 2H11V13C11 14.66 9.66 16 8 16C6.34 16 5 14.66 5 13C5 11.34 6.34 10 8 10C8.35 10 8.68 10.07 9 10.18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const InstagramCustomIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect
      x="3"
      y="3"
      width="14"
      height="14"
      rx="4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="10"
      cy="10"
      r="3.5"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="14.5" cy="5.5" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export const YouTubeCustomIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M17 6C17 4.34315 15.6569 3 14 3H6C4.34315 3 3 4.34315 3 6V14C3 15.6569 4.34315 17 6 17H14C15.6569 17 17 15.6569 17 14V6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.5 7.5L13 10L8.5 12.5V7.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

export const TwitterCustomIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M3 3L8.5 10.5L3 17H4.5L9 11.5L12.5 17H17L11 9L16.5 3H15L10.5 8L7.5 3H3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FacebookCustomIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle
      cx="10"
      cy="10"
      r="7"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 6H11C10.45 6 10 6.45 10 7V8H12V10H10V16H8V10H7V8H8V7C8 5.34 9.34 4 11 4H12V6Z"
      fill="currentColor"
    />
  </svg>
);

// Utility Icons for Creator Cards
export const FollowersIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="7" cy="6" r="2.5" stroke="currentColor" strokeWidth="2" />
    <circle cx="13.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="2" />
    <path
      d="M2.5 16C2.5 13.79 4.29 12 6.5 12H7.5C9.71 12 11.5 13.79 11.5 16M12 16C12 14.34 12.67 12.84 13.75 11.75"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LocationIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M10 17C10 17 15 12 15 8C15 5.24 12.76 3 10 3C7.24 3 5 5.24 5 8C5 12 10 17 10 17Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const EngagementIcon: React.FC<PlatformIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M3 15L3 11M7 15L7 9M11 15V7M15 15V5M17 15V3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
