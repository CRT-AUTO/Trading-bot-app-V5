import React, { useState, useEffect, useRef } from 'react';
import { Copy, RefreshCw, AlertTriangle, Check, Settings } from 'lucide-react';
import { calculateCompoundGrowth, calculateCompoundedProfits, calculateCompoundedRMultiple, generateCompoundGrowthTable, calculateCompoundPositionSize, checkOverlappingStops, calculateCombinedRiskProfile } from '../utils/compounding';
import { Trade, saveTradeToJournal, closeTradeViaWebhook } from '../utils/webhook';
import { useSupabase } from '../contexts/SupabaseContext';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import SystemSelect from './SystemSelect';

interface CalculatorProps {
  livePrice: string;
  selectedCrypto: string;
}

type ApiKey = {
  id: string;
  name: string;
  exchange: string;
  account_type: string;
  is_default: boolean;
};

export const Calculator: React.FC<CalculatorProps> = ({ livePrice, selectedCrypto }) => {
  // Main form inputs
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>('');
  const [riskAmount, setRiskAmount] = useState<string>('1');
  const [availableCapital, setAvailableCapital] = useState<string>('100');
  const [takerFee, setTakerFee] = useState<string>('0.055');
  const [makerFee, setMakerFee] = useState<string>('0.02');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [decimalPlaces, setDecimalPlaces] = useState<number>(4);

  // Fee type checkboxes
  const [entryTaker, setEntryTaker] = useState<boolean>(true);
  const [entryMaker, setEntryMaker] = useState<boolean>(false);
  const [exitTaker, setExitTaker] = useState<boolean>(true);
  const [exitMaker, setExitMaker] = useState<boolean>(false);

  // Journal entry fields (moved from JournalEntry component)
  const [systemName, setSystemName] = useState<string>('');
  const [entryPicUrl, setEntryPicUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Calculated values
  const [positionSizeBeforeFees, setPositionSizeBeforeFees] = useState<string>('');
  const [positionSizeAfterFees, setPositionSizeAfterFees] = useState<string>('');
  const [leverageNeeded, setLeverageNeeded] = useState<string>('');
  const [totalFees, setTotalFees] = useState<string>('');
  const [maxRisk, setMaxRisk] = useState<string>('');
  const [liquidationPrice, setLiquidationPrice] = useState<string>('');
  const [riskPercentage, setRiskPercentage] = useState<number>(0);
  const [isLiquidationRisky, setIsLiquidationRisky] = useState<boolean>(false);

  // Trade management
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Open trade management enhancements
  const [tradeEntryNotes, setTradeEntryNotes] = useState<Record<string, string>>({});
  const [tradeMidNotes, setTradeMidNotes] = useState<Record<string, string>>({});
  const [tradeExitNotes, setTradeExitNotes] = useState<Record<string, string>>({});
  const [tradeEntryPics, setTradeEntryPics] = useState<Record<string, string>>({});
  const [tradeExitPics, setTradeExitPics] = useState<Record<string, string>>({});
  const [tradeTakeProfits, setTradeTakeProfits] = useState<Record<string, string>>({});

  // Compounding fields
  const [showCompounding, setShowCompounding] = useState<boolean>(false);
  const [initialCapital, setInitialCapital] = useState<string>('1000');
  const [profitPercentage, setProfitPercentage] = useState<string>('5');
  const [numberOfTrades, setNumberOfTrades] = useState<string>('10');
  const [winRate, setWinRate] = useState<string>('70');
  const [compoundResult, setCompoundResult] = useState<number | null>(null);
  const [compoundTable, setCompoundTable] = useState<number[]>([]);

  // Advanced compounding states
  const [includeUnrealizedProfits, setIncludeUnrealizedProfits] = useState<boolean>(false);
  const [hasOverlappingStops, setHasOverlappingStops] = useState<boolean>(false);
  const [combinedRiskProfile, setCombinedRiskProfile] = useState<{
    totalRiskPercentage: number;
    risksPerTrade: { tradeId: string; riskPercentage: number }[];
    isExceedingRiskLimit: boolean;
  } | null>(null);
  
  // Supabase and auth
  const { supabase } = useSupabase();
  const { user } = useAuth();
  
  // API key selection
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string>('');
  const [testMode, setTestMode] = useState<boolean>(false);

  // Load open trades from localStorage
  useEffect(() => {
    const savedTrades = localStorage.getItem('openTrades');
    if (savedTrades) {
      const parsedTrades = JSON.parse(savedTrades);
      setOpenTrades(parsedTrades);
      
      // Initialize state for trade journal fields
      const entryNotesInit: Record<string, string> = {};
      const midNotesInit: Record<string, string> = {};
      const exitNotesInit: Record<string, string> = {};
      const entryPicsInit: Record<string, string> = {};
      const exitPicsInit: Record<string, string> = {};
      const takeProfitsInit: Record<string, string> = {};
      
      parsedTrades.forEach((trade: Trade) => {
        entryNotesInit[trade.tradeId] = trade.entryNotes || '';
        midNotesInit[trade.tradeId] = trade.midTradeNotes || '';
        exitNotesInit[trade.tradeId] = trade.notes || '';
        entryPicsInit[trade.tradeId] = trade.entryPicUrl || '';
        exitPicsInit[trade.tradeId] = trade.exitPicUrl || '';
        takeProfitsInit[trade.tradeId] = trade.takeProfitPrice ? trade.takeProfitPrice.toString() : '';
      });
      
      setTradeEntryNotes(entryNotesInit);
      setTradeMidNotes(midNotesInit);
      setTradeExitNotes(exitNotesInit);
      setTradeEntryPics(entryPicsInit);
      setTradeExitPics(exitPicsInit);
      setTradeTakeProfits(takeProfitsInit);
    }

    // Load saved calculator settings
    const savedSettings = localStorage.getItem('calculatorSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setTakerFee(settings.takerFee || '0.055');
      setMakerFee(settings.makerFee || '0.02');
      setRiskAmount(settings.riskAmount || '20');
      setAvailableCapital(settings.availableCapital || '1000');
      setDecimalPlaces(settings.decimalPlaces || 4);
      setEntryTaker(settings.entryTaker !== undefined ? settings.entryTaker : true);
      setEntryMaker(settings.entryMaker || false);
      setExitTaker(settings.exitTaker !== undefined ? settings.exitTaker : true);
      setExitMaker(settings.exitMaker || false);
      setTestMode(settings.testMode || false);
    }
  }, []);
  
  // Fetch API keys
  useEffect(() => {
    const fetchApiKeys = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('api_keys')
          .select('id, name, exchange, account_type, is_default')
          .eq('user_id', user.id)
          .eq('exchange', 'bybit')
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        
        setApiKeys(data || []);
        
        // Select default key if available
        const defaultKey = data?.find(key => key.is_default);
        if (defaultKey) {
          setSelectedApiKeyId(defaultKey.id);
        }
      } catch (error) {
        console.error('Error fetching API keys:', error);
      }
    };
    
    fetchApiKeys();
  }, [user, supabase]);
  
  // Save calculator settings to localStorage when they change
  useEffect(() => {
    const settings = {
      takerFee,
      makerFee,
      riskAmount,
      availableCapital,
      decimalPlaces,
      entryTaker,
      entryMaker,
      exitTaker,
      exitMaker,
      testMode
    };
    localStorage.setItem('calculatorSettings', JSON.stringify(settings));
  }, [
    takerFee,
    makerFee,
    riskAmount,
    availableCapital,
    decimalPlaces,
    entryTaker,
    entryMaker,
    exitTaker,
    exitMaker,
    testMode
  ]);

  // Save open trades to localStorage whenever they change
  useEffect(() => {
    // Update trades with the latest journal field values
    const updatedTrades = openTrades.map(trade => ({
      ...trade,
      notes: tradeExitNotes[trade.tradeId] || trade.notes,
      entryNotes: tradeEntryNotes[trade.tradeId] || trade.entryNotes,
      midTradeNotes: tradeMidNotes[trade.tradeId] || trade.midTradeNotes,
      entryPicUrl: tradeEntryPics[trade.tradeId] || trade.entryPicUrl,
      exitPicUrl: tradeExitPics[trade.tradeId] || trade.exitPicUrl,
      takeProfitPrice: tradeTakeProfits[trade.tradeId] ? parseFloat(tradeTakeProfits[trade.tradeId]) : trade.takeProfitPrice
    }));
    
    localStorage.setItem('openTrades', JSON.stringify(updatedTrades));
  }, [
    openTrades, 
    tradeEntryNotes, 
    tradeMidNotes, 
    tradeExitNotes, 
    tradeEntryPics, 
    tradeExitPics,
    tradeTakeProfits
  ]);

  // Update entry price when live price changes
  useEffect(() => {
    if (livePrice) {
      setEntryPrice(parseFloat(livePrice).toFixed(2));
    }
  }, [livePrice]);

  // Reset success/error messages after 3 seconds
  useEffect(() => {
    if (saveSuccess || saveError) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
        setSaveError(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [saveSuccess, saveError]);

  // Calculate position size and other values whenever inputs change
  useEffect(() => {
    if (entryPrice && stopLoss) {
      calculatePositionSize();
    }
  }, [entryPrice, stopLoss, riskAmount, takerFee, makerFee, direction, entryTaker, entryMaker, exitTaker, exitMaker, decimalPlaces, availableCapital, openTrades, includeUnrealizedProfits, showCompounding]);

  // Auto-detect direction based on entry price and stop loss
  useEffect(() => {
    if (entryPrice && stopLoss) {
      const entry = parseFloat(entryPrice);
      const stop = parseFloat(stopLoss);

      if (!isNaN(entry) && !isNaN(stop)) {
        if (entry > stop) {
          setDirection('long');
        } else if (entry < stop) {
          setDirection('short');
        }
        // If entry equals stop, we don't change the direction to avoid flip-flopping
      }
    }
  }, [entryPrice, stopLoss]);

  // Check for overlapping stops when entry price or stop loss changes
  useEffect(() => {
    if (entryPrice && stopLoss && openTrades.length > 0 && showCompounding) {
      const entry = parseFloat(entryPrice);
      const stop = parseFloat(stopLoss);

      if (!isNaN(entry) && !isNaN(stop)) {
        const overlapping = checkOverlappingStops(openTrades, entry, stop);
        setHasOverlappingStops(overlapping);
      }
    } else {
      setHasOverlappingStops(false);
    }
  }, [entryPrice, stopLoss, openTrades, showCompounding]);

  // Calculate combined risk profile when open trades change
  useEffect(() => {
    if (openTrades.length > 0 && availableCapital) {
      const capital = parseFloat(availableCapital);
      if (!isNaN(capital)) {
        const profile = calculateCombinedRiskProfile(openTrades, capital);
        setCombinedRiskProfile(profile);
      }
    } else {
      setCombinedRiskProfile(null);
    }
  }, [openTrades, availableCapital]);

  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Handle fee type checkboxes
  const handleEntryTakerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEntryTaker(checked);
    if (checked) setEntryMaker(false);
  };

  const handleEntryMakerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEntryMaker(checked);
    if (checked) setEntryTaker(false);
  };

  const handleExitTakerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setExitTaker(checked);
    if (checked) setExitMaker(false);
  };

  const handleExitMakerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setExitMaker(checked);
    if (checked) setExitTaker(false);
  };

  // Calculate the position size based on inputs
  const calculatePositionSize = () => {
    if (!entryPrice || !stopLoss || !riskAmount || !availableCapital) {
      setPositionSizeBeforeFees('');
      setPositionSizeAfterFees('');
      setLeverageNeeded('');
      setTotalFees('');
      setMaxRisk('');
      setLiquidationPrice('');
      setRiskPercentage(0);
      setIsLiquidationRisky(false);
      return;
    }

    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    const risk = parseFloat(riskAmount);
    const capital = parseFloat(availableCapital);
    const takerFeeRate = parseFloat(takerFee) / 100;
    const makerFeeRate = parseFloat(makerFee) / 100;
    
    // Validate inputs
    if (isNaN(entry) || isNaN(stop) || isNaN(risk) || isNaN(capital) || 
        isNaN(takerFeeRate) || isNaN(makerFeeRate) || entry === stop) {
      return;
    }
    
    // Determine entry and exit fee rates
    const entryFeeRate = entryTaker ? takerFeeRate : (entryMaker ? makerFeeRate : 0);
    const exitFeeRate = exitTaker ? takerFeeRate : (exitMaker ? makerFeeRate : 0);
    
    // Automatically determine direction based on entry and stop loss
    const isLong = entry > stop;
    const tradeDirection = isLong ? 'long' : 'short';
    setDirection(tradeDirection as 'long' | 'short');
    
    // Corrected position sizing logic
    const priceDifference = Math.abs(stop - entry);
    // Size before fees calculation (for reference only)
    const sizeBeforeFees = risk / priceDifference;
    setPositionSizeBeforeFees(sizeBeforeFees.toFixed(decimalPlaces));
    
    // Corrected position size calculation that accounts for fees properly
    // For a position size s:
    // s × (priceDifference) + s × entry × entryFeeRate + s × stop × exitFeeRate = risk
    // Solve for s:
    // s = risk / (priceDifference + entry × entryFeeRate + stop × exitFeeRate)
    const feeFactor = entry * entryFeeRate + stop * exitFeeRate;
    const effectiveDifference = priceDifference + feeFactor;
    
    // Calculate the correct position size that considers fees upfront
    const sizeAfterFees = risk / effectiveDifference;
    
    // Calculate fees based on the correct position size
    const entryFee = sizeAfterFees * entry * entryFeeRate;
    const exitFee = sizeAfterFees * stop * exitFeeRate;
    const totalFeesAmount = entryFee + exitFee;
    
    // Display negative size for short positions (for UI display only)
    const displaySize = tradeDirection === 'short' ? -sizeAfterFees : sizeAfterFees;
    setPositionSizeAfterFees(displaySize.toFixed(decimalPlaces));
    setTotalFees(totalFeesAmount.toFixed(2));
    
    // Max risk is always the input risk amount (we've calculated position size to ensure this)
    setMaxRisk(risk.toFixed(2));
    
    // Calculate leverage needed (use absolute value for calculation)
    const positionValue = sizeAfterFees * entry;
    const leverageValue = positionValue / capital;
    
    // Sign the leverage for display
    const displayLeverage = tradeDirection === 'short' ? -leverageValue : leverageValue;
    setLeverageNeeded(displayLeverage.toFixed(2) + 'x');
    
    // Calculate liquidation price
    let liquidationValue;
    if (isLong) {
      // For long positions, liquidation is below entry
      liquidationValue = Math.max(0, entry * (1 - 1 / leverageValue));
    } else {
      // For short positions, liquidation is above entry
      // Note: For shorts, we use the absolute value of leverage for the calculation
      liquidationValue = entry * (1 + 1 / leverageValue);
    }
    setLiquidationPrice(liquidationValue.toFixed(2));
    
    // Check if liquidation would happen before stop loss
    const isRisky = isLong ? 
      liquidationValue > stop : // For long: liquidation is above stop loss (would hit first)
      liquidationValue < stop;  // For short: liquidation is below stop loss (would hit first)
    setIsLiquidationRisky(isRisky);
    
    // Calculate risk percentage of capital
    const riskPercent = (risk / capital) * 100;
    setRiskPercentage(riskPercent);
  };

  // Calculate compounding results
  const calculateCompounding = () => {
    const capital = parseFloat(initialCapital);
    const profit = parseFloat(profitPercentage);
    const trades = parseInt(numberOfTrades);
    const win = parseFloat(winRate);
    const feeRate = entryTaker ? parseFloat(takerFee) : parseFloat(makerFee);
    
    if (isNaN(capital) || isNaN(profit) || isNaN(trades) || isNaN(win) || isNaN(feeRate)) {
      return;
    }
    
    const result = calculateCompoundedProfits(capital, profit, trades, win, feeRate);
    setCompoundResult(result);
    
    // Generate table for visualization
    const table = generateCompoundGrowthTable(capital, profit, trades, win, feeRate);
    setCompoundTable(table);
  };

  // Reset all form fields
  const resetForm = () => {
    setEntryPrice('');
    setStopLoss('');
    setTakeProfitPrice('');
    setRiskAmount('20');
    setAvailableCapital('1000');
    setTakerFee('0.055');
    setMakerFee('0.02');
    setDirection('long');
    setSystemName('');
    setEntryPicUrl('');
    setNotes('');
    setPositionSizeBeforeFees('');
    setPositionSizeAfterFees('');
    setLeverageNeeded('');
    setTotalFees('');
    setMaxRisk('');
    setLiquidationPrice('');
    setRiskPercentage(0);
    setEntryTaker(true);
    setEntryMaker(false);
    setExitTaker(true);
    setExitMaker(false);
    setIsLiquidationRisky(false);
  };

  // Save trade to journal and execute on Bybit
  const saveToJournal = async () => {
    if (!user) {
      setSaveError('You must be logged in to save trades');
      return;
    }
    
    if (!entryPrice || !stopLoss || !positionSizeAfterFees) {
      setSaveError('Please fill all required fields and ensure position size is valid');
      return;
    }
    
    // Validation check for API key if not in test mode
    if (!testMode && !selectedApiKeyId && apiKeys.length > 0) {
      setSaveError('Please select an API key or enable test mode');
      return;
    }
    
    setSaving(true);
    setSaveError(null);
    
    try {
      // Parse leverage from leverageNeeded by removing the 'x' suffix
      const leverageValue = parseFloat(leverageNeeded.replace('x', ''));
      
      // Prepare data for API call
      const tradeData = {
        user_id: user.id,
        api_key_id: testMode ? null : selectedApiKeyId,
        symbol: selectedCrypto,
        side: direction === 'long' ? 'Buy' : 'Sell',
        entry_price: parseFloat(entryPrice),
        quantity: Math.abs(parseFloat(positionSizeAfterFees)),
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        take_profit: takeProfitPrice ? parseFloat(takeProfitPrice) : null,
        max_risk: parseFloat(riskAmount),
        leverage: leverageValue,
        system_id: systemName || null,
        notes: notes || null,
        pic_entry: entryPicUrl || null,
        order_type: entryTaker ? 'Market' : 'Limit',
        test_mode: testMode
      };
      
      // Call the edge function to execute the trade and save it
      const response = await fetch('/.netlify/functions/executeManualTrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradeData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute and save trade');
      }
      
      const result = await response.json();
      
      // Add to open trades list
      const newTrade: Trade = {
        tradeId: result.tradeId,
        symbol: selectedCrypto,
        entryPrice: parseFloat(entryPrice),
        direction: direction,
        positionSize: Math.abs(parseFloat(positionSizeAfterFees)),
        stopLoss: parseFloat(stopLoss),
        riskAmount: parseFloat(riskAmount),
        riskPercentage: riskPercentage,
        leverage: leverageValue,
        fee: entryTaker ? parseFloat(takerFee) : parseFloat(makerFee),
        systemName: systemName || '',
        entryPicUrl: entryPicUrl || '',
        entryNotes: notes || '',
        midTradeNotes: '',
        notes: '', // Exit notes - reset for the open trade display
        exitPicUrl: '',
        takeProfitPrice: takeProfitPrice ? parseFloat(takeProfitPrice) : 0,
        timestamp: Date.now(),
        orderId: result.orderId
      };
      
      setOpenTrades(prevTrades => [...prevTrades, newTrade]);
      
      // Initialize journal fields for the new trade
      setTradeEntryNotes(prev => ({ ...prev, [result.tradeId]: notes || '' }));
      setTradeMidNotes(prev => ({ ...prev, [result.tradeId]: '' }));
      setTradeExitNotes(prev => ({ ...prev, [result.tradeId]: '' }));
      setTradeEntryPics(prev => ({ ...prev, [result.tradeId]: entryPicUrl || '' }));
      setTradeExitPics(prev => ({ ...prev, [result.tradeId]: '' }));
      setTradeTakeProfits(prev => ({ 
        ...prev, 
        [result.tradeId]: takeProfitPrice || ''
      }));
      
      setSaveSuccess(true);
      resetForm();
    } catch (error: any) {
      console.error('Error executing and saving trade:', error);
      setSaveError(error.message || 'Failed to execute and save trade');
    } finally {
      setSaving(false);
    }
  };

  // Handle field changes for open trades
  const handleTradeEntryNotesChange = (tradeId: string, value: string) => {
    setTradeEntryNotes(prev => ({ ...prev, [tradeId]: value }));
  };

  const handleTradeMidNotesChange = (tradeId: string, value: string) => {
    setTradeMidNotes(prev => ({ ...prev, [tradeId]: value }));
  };

  const handleTradeExitNotesChange = (tradeId: string, value: string) => {
    setTradeExitNotes(prev => ({ ...prev, [tradeId]: value }));
  };

  const handleTradeEntryPicChange = (tradeId: string, value: string) => {
    setTradeEntryPics(prev => ({ ...prev, [tradeId]: value }));
  };

  const handleTradeExitPicChange = (tradeId: string, value: string) => {
    setTradeExitPics(prev => ({ ...prev, [tradeId]: value }));
  };

  const handleTradeTakeProfitChange = (tradeId: string, value: string) => {
    setTradeTakeProfits(prev => ({ ...prev, [tradeId]: value }));
  };

  // Handle trade selection
  const handleTradeSelect = (tradeId: string) => {
    setSelectedTrade(tradeId === selectedTrade ? null : tradeId);
  };

  // Close a trade
  const closeTrade = async () => {
    if (!selectedTrade) return;
    
    const tradeToClose = openTrades.find(trade => trade.tradeId === selectedTrade);
    if (!tradeToClose) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      // Prepare close data with all journal fields
      const closeData = {
        notes: tradeExitNotes[selectedTrade] || '',
        exitPicUrl: tradeExitPics[selectedTrade] || '',
        // Include entry notes and mid-trade notes
        entryNotes: tradeEntryNotes[selectedTrade] || '',
        midTradeNotes: tradeMidNotes[selectedTrade] || '',
        // Include the updated take profit price
        takeProfit: tradeTakeProfits[selectedTrade] ? parseFloat(tradeTakeProfits[selectedTrade]) : undefined,
        // If we have live price, use it as exit price, otherwise leave undefined
        exitPrice: livePrice ? parseFloat(livePrice) : undefined
      };
      
      // Call the closeManualTrade edge function
      const response = await fetch(`/.netlify/functions/closeManualTrade/${selectedTrade}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(closeData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to close trade');
      }
      
      // Remove from open trades
      setOpenTrades(prevTrades => 
        prevTrades.filter(trade => trade.tradeId !== selectedTrade)
      );
      setSelectedTrade(null);
      setSaveSuccess(true);
    } catch (error: any) {
      console.error('Error closing trade:', error);
      setSaveError(error.message || 'Failed to close trade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Position Calculator and Compounding Calculator - Left Column */}
        <div className="space-y-4">
          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-700">Position Calculator</h3>
            <div className="flex gap-2 mt-2">
              <button 
                onClick={() => setShowCompounding(false)} 
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  !showCompounding ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Position Size
              </button>
              <button 
                onClick={() => setShowCompounding(true)} 
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  showCompounding ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Compounding
              </button>
            </div>
          </div>
          
          {!showCompounding ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry Price
                  </label>
                  <input
                    type="text"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter price"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stop Loss Price
                  </label>
                  <input
                    type="text"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Stop loss"
                  />
                </div>
                
                {/* Take Profit moved here from JournalEntry */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Take Profit Price
                  </label>
                  <input
                    type="text"
                    value={takeProfitPrice}
                    onChange={(e) => setTakeProfitPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Take profit"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Amount (USDT)
                  </label>
                  <input
                    type="text"
                    value={riskAmount}
                    onChange={(e) => setRiskAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Risk amount"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Available Capital (USDT)
                  </label>
                  <input
                    type="text"
                    value={availableCapital}
                    onChange={(e) => setAvailableCapital(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Available capital"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taker Fee (%)
                  </label>
                  <input
                    type="text"
                    value={takerFee}
                    onChange={(e) => setTakerFee(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Taker Fee %"
                    step="0.001"
                    min="0"
                    max="10"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maker Fee (%)
                  </label>
                  <input
                    type="text"
                    value={makerFee}
                    onChange={(e) => setMakerFee(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Maker Fee %"
                    step="0.001"
                    min="0"
                    max="10"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Decimal Places: {decimalPlaces}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="1"
                    value={decimalPlaces}
                    onChange={(e) => setDecimalPlaces(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry Fee Type
                  </label>
                  <div className="flex space-x-3">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={entryTaker}
                        onChange={handleEntryTakerChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Taker</span>
                    </label>
                    
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={entryMaker}
                        onChange={handleEntryMakerChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Maker</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exit Fee Type
                  </label>
                  <div className="flex space-x-3">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={exitTaker}
                        onChange={handleExitTakerChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Taker</span>
                    </label>
                    
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={exitMaker}
                        onChange={handleExitMakerChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Maker</span>
                    </label>
                  </div>
                </div>
              </div>
              
              {/* System Selection */}
              <div>
                <SystemSelect 
                  value={systemName}
                  onChange={setSystemName}
                  disabled={!positionSizeAfterFees}
                />
              </div>
              
              {/* API Key Selection for Trade Execution */}
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Bybit Integration</h3>
                  <Link to="/settings" className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
                    <Settings size={12} className="mr-1" />
                    Manage Keys
                  </Link>
                </div>
                
                {apiKeys.length > 0 ? (
                  <>
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select API Key
                      </label>
                      <select
                        value={selectedApiKeyId}
                        onChange={(e) => setSelectedApiKeyId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 disabled:bg-gray-100"
                        disabled={testMode}
                      >
                        <option value="">Select an API key</option>
                        {apiKeys.map((key) => (
                          <option key={key.id} value={key.id}>
                            {key.name} {key.is_default && '(Default)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={testMode}
                          onChange={(e) => setTestMode(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Test Mode (No real trade)</span>
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="p-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
                    <AlertTriangle size={16} className="inline mr-1" />
                    No API keys found. To execute real trades, please add your Bybit API keys in Settings.
                  </div>
                )}
              </div>
              
              {/* Entry Pic URL and Notes (moved from JournalEntry) */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry Picture URL
                  </label>
                  <input
                    type="text"
                    value={entryPicUrl}
                    onChange={(e) => setEntryPicUrl(e.target.value)}
                    disabled={!positionSizeAfterFees}
                    className={`w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      !positionSizeAfterFees ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="https://example.com/chart-screenshot.png"
                  />
                  {entryPicUrl && (
                    <div className="mt-2 p-2 border border-gray-200 rounded-md">
                      <img 
                        src={entryPicUrl} 
                        alt="Entry chart" 
                        className="max-h-36 object-contain mx-auto"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=Invalid+Image+URL';
                        }}
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!positionSizeAfterFees}
                    rows={3}
                    className={`w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none ${
                      !positionSizeAfterFees ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="Add your entry notes here..."
                  />
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => calculatePositionSize()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Calculate
                </button>
                
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300"
                >
                  Reset
                </button>
              </div>
            </>
          ) : (
            // Compounding Calculator
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Capital (USDT)
                  </label>
                  <input
                    type="text"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Initial capital"
                    step="1"
                    min="1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profit Per Trade (%)
                  </label>
                  <input
                    type="text"
                    value={profitPercentage}
                    onChange={(e) => setProfitPercentage(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Profit %"
                    step="0.1"
                    min="0.1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Trades
                  </label>
                  <input
                    type="text"
                    value={numberOfTrades}
                    onChange={(e) => setNumberOfTrades(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Number of trades"
                    step="1"
                    min="1"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Win Rate (%)
                  </label>
                  <input
                    type="text"
                    value={winRate}
                    onChange={(e) => setWinRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Win rate"
                    step="1"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              {/* Advanced Compounding Options */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Advanced Position Options</h4>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includeUnrealizedProfits}
                      onChange={(e) => setIncludeUnrealizedProfits(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include unrealized profits in risk calculation</span>
                  </label>
                  
                  {/* Entry Price and Stop Loss for Compound Position */}
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Entry Price
                      </label>
                      <input
                        type="text"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Enter price"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stop Loss Price
                      </label>
                      <input
                        type="text"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Stop loss"
                      />
                    </div>
                  </div>
                  
                  {/* Risk Amount for this Position */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Risk Amount (USDT)
                    </label>
                    <input
                      type="text"
                      value={riskAmount}
                      onChange={(e) => setRiskAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Risk amount"
                    />
                  </div>
                </div>
                
                {hasOverlappingStops && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 text-xs">
                    Warning: This position has overlapping stop-loss zones with existing trades. 
                    Position size will be adjusted to maintain overall risk limits.
                  </div>
                )}
                
                {combinedRiskProfile && combinedRiskProfile.isExceedingRiskLimit && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
                    Warning: Combined risk exceeds 2% of capital. 
                    Consider reducing position size or adjusting stops.
                  </div>
                )}
                
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Current Position Size:
                  </span>
                  <span className="text-xs font-medium bg-gray-100 px-3 py-0.5 rounded-full">
                    {positionSizeAfterFees || '0'}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={calculateCompounding}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Calculate Growth
                </button>
                
                <button
                  onClick={calculatePositionSize}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                >
                  Calculate Size
                </button>
              </div>
            </div>
          )}
          
          {/* Success/Error Messages */}
          {saveSuccess && (
            <div className="text-sm p-2 bg-green-50 border border-green-200 rounded-md text-green-700 flex items-center">
              <Check size={16} className="mr-1" />
              Trade saved and executed successfully!
            </div>
          )}
          
          {saveError && (
            <div className="text-sm p-2 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-center">
              <AlertTriangle size={16} className="mr-1" />
              {saveError}
            </div>
          )}
        </div>
        
        {/* Middle column: Results */}
        <div className="space-y-4">
          {/* Results Display */}
          {!showCompounding ? (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Calculation Results</h4>
              
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Size Post-Fees:</span>
                  <div className="flex items-center">
                    <span className="ml-2 text-gray-900 font-medium px-3 py-0.5 bg-gray-100 rounded-full">
                      {positionSizeAfterFees || '0'} {selectedCrypto.replace('USDT', '')}
                    </span>
                    {positionSizeAfterFees && (
                      <button 
                        onClick={() => copyToClipboard(positionSizeAfterFees)}
                        className="ml-1 text-gray-400 hover:text-gray-600"
                        title="Copy to clipboard"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-500">Size Pre-Fees:</span>
                  <span className="ml-2 text-gray-900">
                    {positionSizeBeforeFees || '0'} {selectedCrypto.replace('USDT', '')}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500">Leverage:</span>
                  <span className="ml-2 text-gray-900">
                    {leverageNeeded || '0x'}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500">Total Fees:</span>
                  <span className="ml-2 text-gray-900">
                    {totalFees || '0'} USDT
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500">Max Risk:</span>
                  <span className="ml-2 text-gray-900">
                    {maxRisk || '0'} USDT
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500">Liquidation:</span>
                  <span className={`ml-2 font-medium ${isLiquidationRisky ? 'text-red-600' : 'text-green-600'}`}>
                    {liquidationPrice || '0'}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500">Risk Percentage:</span>
                  <span className={`ml-2 font-medium ${
                    riskPercentage > 2 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {riskPercentage.toFixed(2)}%
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500">Direction:</span>
                  <span className={`ml-2 font-medium ${
                    direction === 'long' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {direction.toUpperCase()}
                  </span>
                </div>
              </div>
              
              {isLiquidationRisky && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
                  Warning: Liquidation price will be reached before stop loss!
                </div>
              )}
            </div>
          ) : (
            // Compounding Results
            compoundResult !== null && (
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Compounding Results</h4>
                
                <div className="text-sm">
                  <div className="mb-2">
                    <span className="text-gray-500">Initial Capital:</span>
                    <span className="ml-2 text-gray-900">
                      {parseFloat(initialCapital).toFixed(2)} USDT
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <span className="text-gray-500">Final Capital:</span>
                    <span className="ml-2 text-green-600 font-medium">
                      {compoundResult.toFixed(2)} USDT
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Total Growth:</span>
                    <span className="ml-2 text-green-600 font-medium">
                      {((compoundResult / parseFloat(initialCapital) - 1) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
                
                {compoundTable.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto">
                    <h5 className="text-xs font-medium text-gray-700 mb-1">Growth Projection</h5>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-200">
                          <th className="py-1 text-left">Trade #</th>
                          <th className="py-1 text-right">Capital</th>
                          <th className="py-1 text-right">Growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compoundTable.map((value, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-1">{index}</td>
                            <td className="py-1 text-right">{value.toFixed(2)} USDT</td>
                            <td className="py-1 text-right">
                              {index === 0 ? '0.00%' : 
                                `${((value / compoundTable[0] - 1) * 100).toFixed(2)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {openTrades.length > 0 && combinedRiskProfile && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <h5 className="text-xs font-medium text-blue-700 mb-1">Combined Risk Profile</h5>
                    <div className="text-xs">
                      <div className="mb-1">
                        <span className="text-gray-700">Total Risk:</span>
                        <span className={`ml-2 font-medium ${
                          combinedRiskProfile.totalRiskPercentage > 2 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {combinedRiskProfile.totalRiskPercentage.toFixed(2)}% of capital
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Risk distribution across {openTrades.length} open trades
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
          
          {!showCompounding && (
            <button
              onClick={saveToJournal}
              disabled={!positionSizeAfterFees || saving}
              className={`w-full px-4 py-2 rounded-md text-sm font-medium ${
                !positionSizeAfterFees || saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  {testMode ? 'Saving Trade...' : 'Executing Trade...'}
                </span>
              ) : (
                testMode ? 'Add to Journal (Test Mode)' : 'Execute Trade on Bybit'
              )}
            </button>
          )}
        </div>
        
        {/* Right Column: Open Trades List */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Open Trades</h3>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 max-h-[650px] overflow-y-auto">
            {openTrades.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                No open trades
              </div>
            ) : (
              <div className="space-y-4">
                {openTrades.map(trade => (
                  <div 
                    key={trade.tradeId}
                    onClick={() => handleTradeSelect(trade.tradeId)}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      selectedTrade === trade.tradeId
                        ? 'bg-blue-50 border border-blue-300'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="font-medium">{trade.symbol}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          trade.direction === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.direction.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(trade.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                      <div>
                        <span className="text-gray-500">Entry:</span>
                        <span className="ml-1 text-gray-900">{trade.entryPrice}</span>
                      </div>
                      
                      <div>
                        <span className="text-gray-500">Stop:</span>
                        <span className="ml-1 text-gray-900">{trade.stopLoss}</span>
                      </div>
                      
                      {/* Moved the TP here */}
                      <div>
                        <span className="text-gray-500">Size:</span>
                        <span className="ml-1 text-gray-900">{trade.positionSize.toFixed(decimalPlaces)}</span>
                      </div>
                      
                      <div>
                        <span className="text-gray-500">Risk:</span>
                        <span className="ml-1 text-gray-900">{trade.riskAmount} USDT</span>
                      </div>
                    </div>
                    
                    {/* Trade Journal Section */}
                    {selectedTrade === trade.tradeId && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                        <h4 className="text-xs font-medium text-gray-700">Trade Journal</h4>
                        
                        {/* Take Profit */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Take Profit Price
                          </label>
                          <input
                            type="text"
                            value={tradeTakeProfits[trade.tradeId] || ''}
                            onChange={(e) => handleTradeTakeProfitChange(trade.tradeId, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Enter take profit price"
                          />
                        </div>
                        
                        {/* Entry Pic URL */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Entry Picture URL
                          </label>
                          <input
                            type="text"
                            value={tradeEntryPics[trade.tradeId] || ''}
                            onChange={(e) => handleTradeEntryPicChange(trade.tradeId, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="https://example.com/entry.png"
                          />
                          {tradeEntryPics[trade.tradeId] && (
                            <div className="mt-1 p-1 border border-gray-200 rounded-md">
                              <img 
                                src={tradeEntryPics[trade.tradeId]} 
                                alt="Entry chart" 
                                className="max-h-28 object-contain mx-auto"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=Invalid+Image+URL';
                                }}
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Exit Pic URL */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Exit Picture URL
                          </label>
                          <input
                            type="text"
                            value={tradeExitPics[trade.tradeId] || ''}
                            onChange={(e) => handleTradeExitPicChange(trade.tradeId, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="https://example.com/exit.png"
                          />
                          {tradeExitPics[trade.tradeId] && (
                            <div className="mt-1 p-1 border border-gray-200 rounded-md">
                              <img 
                                src={tradeExitPics[trade.tradeId]} 
                                alt="Exit chart" 
                                className="max-h-28 object-contain mx-auto"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=Invalid+Image+URL';
                                }}
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Entry Notes */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Entry Notes
                          </label>
                          <textarea
                            value={tradeEntryNotes[trade.tradeId] || ''}
                            onChange={(e) => handleTradeEntryNotesChange(trade.tradeId, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            placeholder="Add entry notes here..."
                            rows={2}
                          />
                        </div>
                        
                        {/* Mid-Trade Notes */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Mid-Trade Notes
                          </label>
                          <textarea
                            value={tradeMidNotes[trade.tradeId] || ''}
                            onChange={(e) => handleTradeMidNotesChange(trade.tradeId, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            placeholder="Add mid-trade notes here..."
                            rows={2}
                          />
                        </div>
                        
                        {/* Exit Notes */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Exit Notes
                          </label>
                          <textarea
                            value={tradeExitNotes[trade.tradeId] || ''}
                            onChange={(e) => handleTradeExitNotesChange(trade.tradeId, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            placeholder="Add exit notes here..."
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Close Trade Button */}
          <button
            onClick={closeTrade}
            disabled={!selectedTrade || saving}
            className={`w-full px-4 py-2 rounded-md text-sm font-medium ${
              !selectedTrade || saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center">
                <RefreshCw size={16} className="animate-spin mr-2" />
                Closing Trade...
              </span>
            ) : (
              'Close Selected Trade'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};