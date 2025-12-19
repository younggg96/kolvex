"use client";

// 圆形权重指示器组件
const WeightCircle = ({ percent }: { percent: number }) => {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="transform -rotate-90"
    >
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-muted"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        className="text-primary/70 transition-all"
      />
    </svg>
  );
};

// 权重显示组件（圆形 + 百分比文字）
export const WeightIndicator = ({ percent }: { percent: number }) => {
  if (percent < 0)
    return (
      <div className="flex items-center justify-center">
        <span className="text-xs min-w-[36px]">-</span>
      </div>
    );
  return (
    <div className="flex items-center justify-end gap-1.5">
      <WeightCircle percent={percent} />
      <span className="text-xs tabular-nums text-muted-foreground min-w-[36px] text-right">
        {percent.toFixed(1)}%
      </span>
    </div>
  );
};

export { WeightCircle };

