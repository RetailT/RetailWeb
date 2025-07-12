
const CircleBounceLoader = () => {
  return (
    <>
      {/* Inline style tag defining keyframes */}
      <style>
        {`
          @keyframes customBounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-30px); /* Adjust height here */
            }
          }
        `}
      </style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-30 backdrop-blur-sm">
        <div className="flex space-x-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 bg-black rounded-full"
              style={{
                animation: "customBounce 1s infinite ease-in-out",
                animationDelay: `${-0.6 + i * 0.1}s`,
              }}
            ></div>
          ))}
        </div>
      </div>
    </>
  );
};

export default CircleBounceLoader;
