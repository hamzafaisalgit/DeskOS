export function calculate(source: string): number {
  const tokens = source.match(/\d*\.\d+|\d+\.?\d*|[()+\-*/]/g) ?? [];
  if (tokens.join("") !== source.replace(/\s/g, "") || !tokens.length)
    throw Error("Invalid expression");
  let i = 0;
  const atom = (): number => {
    if (tokens[i] === "+" || tokens[i] === "-") {
      const sign = tokens[i++];
      return (sign === "-" ? -1 : 1) * atom();
    }
    if (tokens[i] === "(") {
      i++;
      const n = sum();
      if (tokens[i++] !== ")") throw Error("Missing parenthesis");
      return n;
    }
    const token = tokens[i++];
    if (!token || !/^(?:\d+\.?\d*|\.\d+)$/.test(token))
      throw Error("Expected a number");
    return Number(token);
  };
  const product = (): number => {
    let n = atom();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const op = tokens[i++];
      const b = atom();
      if (op === "/" && b === 0) throw Error("Cannot divide by zero");
      n = op === "*" ? n * b : n / b;
    }
    return n;
  };
  const sum = (): number => {
    let n = product();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++];
      const b = product();
      n = op === "+" ? n + b : n - b;
    }
    return n;
  };
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result))
    throw Error("Invalid expression");
  return Number(result.toPrecision(12));
}
