import React from 'react';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

export type ProfileIconName =
  | 'user'
  | 'year'
  | 'palette'
  | 'collage'
  | 'bell'
  | 'mail'
  | 'lock'
  | 'moon'
  | 'message'
  | 'star'
  | 'info';

export function ProfileIcon({
  name,
  color,
}: {
  name: ProfileIconName;
  color: string;
}) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
  };

  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      {name === 'user' ? (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...common} />
          <Circle cx={12} cy={7} r={4} {...common} />
        </>
      ) : null}
      {name === 'year' ? (
        <Path
          d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
          {...common}
        />
      ) : null}
      {name === 'palette' ? (
        <>
          <Circle cx={13.5} cy={6.5} r={1.3} {...common} />
          <Circle cx={17.5} cy={10.5} r={1.3} {...common} />
          <Circle cx={8.5} cy={7.5} r={1.3} {...common} />
          <Circle cx={6.5} cy={12.5} r={1.3} {...common} />
          <Path
            d="M12 2a10 10 0 1 0 0 20c.8 0 1.4-.6 1.4-1.2 0-.3-.2-.6-.3-.8-.2-.2-.3-.5-.3-.7 0-.6.5-1.1 1.2-1.1H16c3.3 0 6-2.6 6-5.9C22 5.9 17.6 2 12 2z"
            {...common}
          />
        </>
      ) : null}
      {name === 'collage' ? (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={1} {...common} />
          <Rect x={14} y={3} width={7} height={7} rx={1} {...common} />
          <Rect x={3} y={14} width={7} height={7} rx={1} {...common} />
          <Rect x={14} y={14} width={7} height={7} {...common} />
        </>
      ) : null}
      {name === 'bell' ? (
        <Path
          d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
          {...common}
        />
      ) : null}
      {name === 'mail' ? (
        <>
          <Rect x={2} y={4} width={20} height={16} rx={2} {...common} />
          <Path d="m22 6-10 7L2 6" {...common} />
        </>
      ) : null}
      {name === 'lock' ? (
        <>
          <Rect x={3} y={11} width={18} height={10} rx={2} {...common} />
          <Path d="M7 11V7a5 5 0 0 1 10 0v4" {...common} />
        </>
      ) : null}
      {name === 'moon' ? (
        <Path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" {...common} />
      ) : null}
      {name === 'message' ? (
        <Path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          {...common}
        />
      ) : null}
      {name === 'star' ? (
        <Polygon
          points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"
          {...common}
        />
      ) : null}
      {name === 'info' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Path d="M12 16v-4M12 8h.01" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
