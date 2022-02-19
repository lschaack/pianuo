import { FC, useCallback, useEffect, useState } from "react";

import { Knob } from "components/Knob";

export type NumberKeys<T> = {
  [Key in keyof T]: T[Key] extends number ? Key : never;
}[keyof T];

export type NumericParams<T> = Record<NumberKeys<T>, number>;

type ModuleProps<T> = {
  name: string;
  initParams: NumericParams<T>;
  onChange: (params: NumericParams<T>) => void;
}

const WIPModule = <T extends {}>({ name, initParams, onChange: handleChange }: ModuleProps<T>) => {
  const [ params, setParams ] = useState(initParams);

  useEffect(() => handleChange(params), [ params, handleChange ]);

  const Knobs = useCallback(() => (
    <ul>
      {Object.entries<number>(initParams).map(([ paramName, initVal ], index) => (
        <li key={`${paramName}-${index}`}>
          <label>{paramName}</label>
          <Knob
            init={initVal}
            onChange={value => setParams(prev => ({ ...prev, [paramName]: value }))}
          />
        </li>
      ))}
    </ul>
  ), [ initParams ]);

  return (
    <div>
      <h2>{name}</h2>
      <Knobs />
    </div>
  );
}
