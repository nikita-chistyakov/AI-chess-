
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { createContext, useState, useContext, ReactNode } from 'react';

interface SettingsContextType {
  orbBaseDelay: number;
  setOrbBaseDelay: (delay: number) => void;
  orbWordDelay: number;
  setOrbWordDelay: (delay: number) => void;
  proactiveGreeting: boolean;
  setProactiveGreeting: (enabled: boolean) => void;
  proactiveGreetingTimeout: number;
  setProactiveGreetingTimeout: (timeout: number) => void;
  useStrategicAdvisor: boolean;
  setUseStrategicAdvisor: (enabled: boolean) => void;
  sendBoardImage: boolean;
  setSendBoardImage: (enabled: boolean) => void;
  handoffDelay: number;
  setHandoffDelay: (delay: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orbBaseDelay, setOrbBaseDelay] = useState(500);
  const [orbWordDelay, setOrbWordDelay] = useState(300);
  const [proactiveGreeting, setProactiveGreeting] = useState(true);
  const [proactiveGreetingTimeout, setProactiveGreetingTimeout] = useState(2000);
  const [useStrategicAdvisor, setUseStrategicAdvisor] = useState(true);
  const [sendBoardImage, setSendBoardImage] = useState(true);
  const [handoffDelay, setHandoffDelay] = useState(0);

  return (
    <SettingsContext.Provider value={{
      orbBaseDelay,
      setOrbBaseDelay,
      orbWordDelay,
      setOrbWordDelay,
      proactiveGreeting,
      setProactiveGreeting,
      proactiveGreetingTimeout,
      setProactiveGreetingTimeout,
      useStrategicAdvisor,
      setUseStrategicAdvisor,
      sendBoardImage,
      setSendBoardImage,
      handoffDelay,
      setHandoffDelay,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
