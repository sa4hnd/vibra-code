function Component() {
  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-2 shadow-lg">
      <div className="flex -space-x-1.5">
        <img
          className="rounded-full ring-1 ring-white/10 w-5 h-5 object-cover"
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
          width={20}
          height={20}
          alt="Developer 01"
        />
        <img
          className="rounded-full ring-1 ring-white/10 w-5 h-5 object-cover"
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
          width={20}
          height={20}
          alt="Developer 02"
        />
        <img
          className="rounded-full ring-1 ring-white/10 w-5 h-5 object-cover"
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=Mike"
          width={20}
          height={20}
          alt="Developer 03"
        />
        <img
          className="rounded-full ring-1 ring-white/10 w-5 h-5 object-cover"
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=Emma"
          width={20}
          height={20}
          alt="Developer 04"
        />
      </div>
      <p className="px-2 text-xs text-gray-300">
        Trusted by <strong className="font-medium text-white">60K+</strong> users.
      </p>
    </div>
  );
}

export { Component };
