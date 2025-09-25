import { useCallback, useMemo, useState } from "react";

export const applyCepMask = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  const limitedNumbers = numbers.slice(0, 8);

  if (limitedNumbers.length <= 5) {
    return limitedNumbers;
  }

  return `${limitedNumbers.slice(0, 5)}-${limitedNumbers.slice(5)}`;
};

export const removeCepMask = (maskedValue: string): string => {
  return maskedValue.replace(/\D/g, "");
};

export const useCepMask = (initialValue: string = "") => {
  const [cep, setCep] = useState<string>(initialValue);

  const handleCepChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const maskedValue = applyCepMask(e.target.value);
      setCep(maskedValue);
    },
    []
  );

  const getCepNumbers = useCallback(() => {
    return removeCepMask(cep);
  }, [cep]);

  const isValid = useMemo(() => {
    return removeCepMask(cep).length === 8;
  }, [cep]);

  return {
    cep,
    handleCepChange,
    getCepNumbers,
    isValid,
    setCep,
  };
};
