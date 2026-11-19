export function calculate(source: string, degrees = false): number {
  const clean = source.replace(/π/g, "pi").toLowerCase().replace(/\s/g, "");
  const tokens =
    clean.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^!%]/g) ??
    [];
  if (tokens.join("") !== clean || !tokens.length)
    throw Error("Invalid expression");
  let i = 0;
  const atom = (): number => {
    const token = tokens[i++];
    if (token === "(") {
      const n = sum();
      if (tokens[i++] !== ")") throw Error("Missing parenthesis");
      return n;
    }
    if (token === "pi") return Math.PI;
    if (token === "e") return Math.E;
    if (["sin", "cos", "tan", "sqrt", "log", "ln", "abs"].includes(token)) {
      if (tokens[i++] !== "(") throw Error("Functions require parentheses");
      const n = sum();
      if (tokens[i++] !== ")") throw Error("Missing parenthesis");
      const angle = degrees ? (n * Math.PI) / 180 : n;
      switch (token) {
        case "sin":
          return Math.sin(angle);
        case "cos":
          return Math.cos(angle);
        case "tan":
          if (Math.abs(Math.cos(angle)) < 1e-14)
            throw Error("Undefined tangent");
          return Math.tan(angle);
        case "sqrt":
          if (n < 0) throw Error("Square root needs a nonnegative number");
          return Math.sqrt(n);
        case "log":
          return Math.log10(n);
        case "ln":
          return Math.log(n);
        default:
          return Math.abs(n);
      }
    }
    if (!token || !/^\d*\.?\d+(?:e[+-]?\d+)?$|^\d+\.$/.test(token))
      throw Error("Expected a number");
    return Number(token);
  };
  const postfix = (): number => {
    let n = atom();
    while (tokens[i] === "!" || tokens[i] === "%") {
      if (tokens[i++] === "%") n /= 100;
      else {
        if (!Number.isInteger(n) || n < 0 || n > 170)
          throw Error("Factorial supports integers 0–170");
        let f = 1;
        for (let j = 2; j <= n; j++) f *= j;
        n = f;
      }
    }
    return n;
  };
  const power = (): number => {
    const n = postfix();
    return tokens[i] === "^" ? (i++, n ** unary()) : n;
  };
  const unary = (): number =>
    tokens[i] === "-"
      ? (i++, -unary())
      : tokens[i] === "+"
        ? (i++, unary())
        : power();
  const product = (): number => {
    let n = unary();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const op = tokens[i++],
        b = unary();
      if (op === "/" && b === 0) throw Error("Cannot divide by zero");
      n = op === "*" ? n * b : n / b;
    }
    return n;
  };
  const sum = (): number => {
    let n = product();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++],
        b = product();
      n = op === "+" ? n + b : n - b;
    }
    return n;
  };
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result))
    throw Error("Invalid expression or overflow");
  return Number(result.toPrecision(12));
}
