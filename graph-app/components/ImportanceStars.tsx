export default function ImportanceStars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-[8px] ${i < n ? "text-amber-400" : "text-gray-700"}`}>★</span>
      ))}
    </span>
  );
}
