import { useEffect, useState, useRef } from "react";

import { useAccount, useBalance } from "wagmi";
import { switchChain } from "@wagmi/core";
import { mainnet, bsc } from "@wagmi/core/chains";
import { Address } from "viem";

import { ToastContainer, toast } from "react-toastify";

import { config } from "@/provider/config";
import ConnectButton from "@/provider/ConnectButton";
import CoinButtons from "./CoinButtons";
import { CoinData, IData } from "../../utils/type";
import {
  getCalcBoardData,
  buyWithETH,
  buyWithBNB,
  buyWithUSDT,
} from "../../web3/hooks/useAPI";

import * as translation from "@/translation/en.json";

import "./ReactToastify.css";
import BNBWarningModal from "../modal/bnbWarningModal";

const coins: CoinData[] = [
  {
    name: translation.presale.buysection.eth,
    symbol: "ethereum.png",
  },
  {
    name: translation.presale.buysection.bnb,
    symbol: "bnb 2.png",
  },
  {
    name: translation.presale.buysection.usdt,
    symbol: "usdt.png",
  },
];

interface BuySectionProps {
  disabled: boolean;
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
}

const BuySection = ({
  disabled,
  selectedNetwork,
  setSelectedNetwork,
}: BuySectionProps) => {
  const { chainId, connector, address } = useAccount();
  const balance = useBalance({ address });
  const ETHBalance = Number(balance.data?.value) / 10 ** 18;

  const [selectedCoin, setSelectedCoin] = useState(coins[0]);

  const [data, setData] = useState<IData>();
  const [inputAmount, setInputAmt] = useState(0);
  const [inputUSDAmount, setInputUSDAmount] = useState(0);
  const [outputAmount, setOutputAmt] = useState(0);
  const [flag, setFlag] = useState(true);

  const [bnbWarningOpen, setBNBWarningOpen] = useState(false);
  const handleBNBWarningOpen = () => setBNBWarningOpen(!bnbWarningOpen);

  const selectedCoinRef = useRef(selectedCoin);
  const inputAmountRef = useRef(inputAmount);
  const flagRef = useRef(flag);

  const notify = (message: string) => toast(message);

  const formatNumber = (number: string) => {
    return number.replace(/(\d)(?=(\d{3})+$)/g, "$1,");
  };

  useEffect(() => {
    selectedCoinRef.current = selectedCoin;
  }, [selectedCoin]);

  useEffect(() => {
    inputAmountRef.current = inputAmount;
  }, [inputAmount]);

  useEffect(() => {
    flagRef.current = flag;
  }, [flag]);

  useEffect(() => {
    const getData = async () => {
      if (flagRef.current) {
        const _data: IData = await getCalcBoardData(address as Address);
        setData(_data);
        handleChange(inputAmountRef.current, _data, false);
      }
    };

    getData();

    const interval = setInterval(() => {
      getData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chainId === 1 && selectedCoin.name !== "USDT") {
      setSelectedCoin(coins[0]);
      if (selectedNetwork === "BNB") setSelectedNetwork("ETH");
    } else if (chainId === 56 && selectedCoin.name !== "USDT") {
      setSelectedCoin(coins[1]);
      if (selectedNetwork === "ETH") setSelectedNetwork("BNB");
    }
  }, [chainId]);

  useEffect(() => {
    if (selectedNetwork === "ETH" && selectedCoin.name !== "USDT") {
      setSelectedCoin(coins[0]);
    } else if (selectedNetwork === "BNB" && selectedCoin.name !== "USDT") {
      setSelectedCoin(coins[1]);
    }
  }, [selectedNetwork]);

  const handleChange = (value: any, currentData = data, flag = true) => {
    if (flag) setInputAmt(value);

    // Get prices
    const ethPrice = Number(currentData?.ethPrice) / 10 ** 18;
    const bnbPrice = Number(currentData?.bnbPrice) / 10 ** 18;
    const curPrice = Number(currentData?.currentPrice) / 10 ** 18;

    let usdtAmt = 0;
    if (selectedCoinRef.current === coins[0]) {
      usdtAmt = ethPrice * value;
    } else if (selectedCoinRef.current === coins[1]) {
      usdtAmt = bnbPrice * value;
    } else {
      usdtAmt = Number(value);
    }
    usdtAmt = usdtAmt ? usdtAmt : 0;

    let output = 0;
    output = Math.floor(Number(usdtAmt) / curPrice);
    output = output ? output : 0;

    setInputUSDAmount(usdtAmt);
    setOutputAmt(output);
  };

  useEffect(() => {
    handleChange(inputAmount);
  }, [selectedCoin]);

  const changeNetwork = async () => {
    if (selectedNetwork === "ETH") {
      if (address) {
        const res = await switchChain(config, { chainId: bsc.id });
        if (res) setSelectedNetwork("BNB");
      } else {
        setSelectedNetwork("BNB");
      }
    } else if (selectedNetwork === "BNB") {
      if (address) {
        const res = await switchChain(config, { chainId: mainnet.id });
        if (res) setSelectedNetwork("ETH");
      } else {
        setSelectedNetwork("ETH");
      }
    }
  };

  interface resProp {
    res: boolean;
    reason?: string;
    hash?: string;
  }

  const buyTMM = async () => {
    setFlag(false);
    let res: resProp = { res: false };
    if (selectedCoin === coins[0]) {
      res = await buyWithETH(
        inputAmount.toString(),
        Number(outputAmount),
        connector
      );
    } else if (selectedCoin === coins[1]) {
      res = await buyWithBNB(
        inputAmount.toString(),
        Number(outputAmount),
        connector
      );
    } else {
      res = await buyWithUSDT(
        inputAmount.toString(),
        Number(outputAmount),
        address as Address,
        connector,
        selectedNetwork
      );
    }
    if (res.res && res.hash) {
      const result = await parseHash(res.hash, selectedNetwork);
      if (result) {
        notify("Purchased successfully!");
      } else {
        notify("Purchase failed, Slippage exceeded, Try again later!");
      }
    } else if (!res.res && res.reason == "metamask rejected")
      notify("User rejected wallet connection!");
    else if (!res.res && res.reason == "slippage error")
      notify("Purchase failed, Slippage exceeded, Try again later!");

    setFlag(true);
  };

  const parseHash = async (hash: string, network: string) => {
    await new Promise((r) => setTimeout(r, 30000));

    const fetchString =
      network === "ETH"
        ? `https://api.etherscan.io/api?module=transaction&action=getstatus&txhash=${hash}&apikey=9SWQUMC632ZYB3TNSF6A67RCPG3VF3D6YJ`
        : `https://api.bscscan.com/api?module=transaction&action=getstatus&txhash=${hash}&apikey=22RBV2E92YSHYFJCUTJK8R2E5SDYK64QYD`;

    const res: any = await fetch(fetchString);
    const rrr = await res.json();
    if (rrr.result.isError === "0") {
      return true;
    } else {
      return false;
    }
  };

  return (
    <>
      <div className="flex gap-4">
        {selectedNetwork === "ETH" && (
          <CoinButtons
            coin={coins[0]}
            selectedCoin={selectedCoin}
            setSelectedCoin={setSelectedCoin}
          />
        )}
        {selectedNetwork === "BNB" && (
          <CoinButtons
            coin={coins[1]}
            selectedCoin={selectedCoin}
            setSelectedCoin={setSelectedCoin}
          />
        )}
        <CoinButtons
          coin={coins[2]}
          selectedCoin={selectedCoin}
          setSelectedCoin={setSelectedCoin}
        />
      </div>

      {address && (
        <div className="w-full flex items-center justify-between">
          <div className="min-w-[100px] border-[1px] border-white h-0"></div>
          <p className="text-xs !w-full text-center">
            {selectedCoin === coins[0] &&
              translation.presale.buysection.ethBalance + ETHBalance.toFixed(4)}
            {selectedCoin === coins[1] &&
              translation.presale.buysection.bnbBalance + ETHBalance.toFixed(4)}
            {selectedCoin === coins[2] &&
              translation.presale.buysection.usdtBalance +
                (selectedNetwork === "ETH"
                  ? (Number(data?.ethUsdtBalance) / 10 ** 6).toFixed(4)
                  : (Number(data?.bscUsdtBalance) / 10 ** 18).toFixed(4))}
          </p>
          <div className="min-w-[100px] border-[1px] border-white h-0"></div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        <div>
          <p className="text-xs text-left">
            {selectedCoin.name} {translation.presale.buysection.youpay}
          </p>
          <div className="flex items-center border-[1px] border-white rounded-lg">
            <input
              type="number"
              className="bg-transparent w-[270px] md:w-[120px] p-2 focus:border-none focus:shadow-none focus:outline-none"
              onChange={(e) => handleChange(e.target.value)}
              value={inputAmount}
            />
            <img
              src={`/assets/images/coins/${selectedCoin.symbol}`}
              className="w-6 h-6 mr-2"
              alt={selectedCoin.name}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-left">
            {translation.presale.tmm}{" "}
            {translation.presale.buysection.youreceive}
          </p>
          <div className="flex items-center border-[1px] border-white rounded-lg">
            <input
              className="bg-transparent w-[270px] md:w-[120px] p-2"
              value={disabled ? 0 : formatNumber(outputAmount.toString())}
              disabled
            />
            <img
              src="/assets/images/coins/tmm.png"
              className="w-6 h-6 mr-2"
              alt="tmm token"
            />
          </div>
        </div>
      </div>

      {address && (
        <div className="text-[10px] text-center flex flex-col gap-1 items-center max-w-[300px]">
          {((ETHBalance < inputAmount && selectedCoin != coins[2]) ||
            (Number(data?.ethUsdtBalance) / 10 ** 6 < inputAmount &&
              selectedCoin == coins[2] &&
              selectedNetwork === "ETH") ||
            (Number(data?.bscUsdtBalance) / 10 ** 18 < inputAmount &&
              selectedCoin == coins[2] &&
              selectedNetwork === "BNB")) && (
            <div className="flex gap-3">
              <p>{translation.presale.buysection.enoughbalance}</p>
            </div>
          )}
          {inputAmount > 0 && (
            <p className="text-[#DB443B]">
              {translation.presale.buysection.makeSure}
              {selectedNetwork == "ETH" ? "0.015 " : "0.0025 "}
              {selectedNetwork == "ETH"
                ? translation.presale.buysection.eth
                : translation.presale.buysection.bnb}
              {translation.presale.buysection.gasAnd}
              {selectedCoin === coins[0]
                ? translation.presale.buysection.eth
                : selectedCoin === coins[1]
                ? translation.presale.buysection.bnb
                : translation.presale.buysection.usdt}
              {translation.presale.buysection.tokenExchange}
            </p>
          )}
        </div>
      )}

      {address && selectedNetwork === "ETH" && (
        <button
          className="bg-[#FFC700] rounded-md text-black text-sm w-[300px] md:w-[310px] h-[40px] disabled:bg-[#FFC70055] disabled:cursor-not-allowed uppercase"
          onClick={() => buyTMM()}
          disabled={
            disabled ||
            inputUSDAmount < Number(data?.minAmt) / 10 ** 18 ||
            (ETHBalance < inputAmount && selectedCoin != coins[2]) ||
            (Number(data?.ethUsdtBalance) / 10 ** 6 < inputAmount &&
              selectedCoin == coins[2] &&
              selectedNetwork === "ETH")
          }
        >
          {translation.presale.buysection.buyAndStake}
        </button>
      )}

      <div
        className={
          "flex md:flex-row justify-center items-center gap-4 md:gap-2 w-full h-full " +
          (address ? "flex-col" : "flex-row")
        }
      >
        {!address ? (
          <ConnectButton />
        ) : (
          <button
            className="bg-[#FFC700] rounded-md text-black text-sm w-[300px] md:w-auto md:min-w-[150px] h-[40px] disabled:bg-[#FFC70055] disabled:cursor-not-allowed uppercase"
            onClick={() => buyTMM()}
            disabled={
              disabled ||
              inputUSDAmount < Number(data?.minAmt) / 10 ** 18 ||
              (ETHBalance < inputAmount && selectedCoin != coins[2]) ||
              (Number(data?.ethUsdtBalance) / 10 ** 6 < inputAmount &&
                selectedCoin == coins[2] &&
                selectedNetwork === "ETH") ||
              (Number(data?.bscUsdtBalance) / 10 ** 18 < inputAmount &&
                selectedCoin == coins[2] &&
                selectedNetwork === "BNB")
            }
          >
            {translation.presale.buysection.buynow}
          </button>
        )}
        <div className="relative group">
          <button
            className={
              "relative md:w-auto md:min-w-[150px] h-[40px] border-[1px] rounded-md flex justify-center items-center gap-1 uppercase text-sm disabled:bg-[#52BF8555] disabled:cursor-not-allowed border-[#F0C010] " +
              (address ? "w-[300px]" : "w-[150px]")
            }
            onClick={() => {
              !address ? changeNetwork() : null;
            }}
          >
            {selectedNetwork === "ETH" ? (
              <img
                src={`/assets/images/coins/ethereum.png`}
                className="w-6 h-6 mr-1"
                alt=""
              />
            ) : (
              <img
                src={`/assets/images/coins/bnb 2.png`}
                className="w-6 h-6 mr-1"
                alt=""
              />
            )}
            {selectedNetwork === "ETH"
              ? translation.presale.buysection.buywitheth
              : translation.presale.buysection.buywithbnb}
          </button>
          {address && (
            <div
              className="bg-black absolute top-[-50px] right-[0px] hidden group-hover:flex items-center min-w-[200px] h-[50px] rounded-md cursor-pointer px-4 text-[#F0C010] hover:text-white"
              onClick={() => {
                selectedNetwork !== "ETH"
                  ? changeNetwork()
                  : handleBNBWarningOpen();
              }}
            >
              {selectedNetwork !== "ETH" ? (
                <>
                  <img
                    src={`/assets/images/coins/ethereum.png`}
                    className="w-6 h-6 mr-3"
                    alt=""
                  />
                  {translation.presale.buysection.buywitheth}
                </>
              ) : (
                <>
                  <img
                    src={`/assets/images/coins/bnb 2.png`}
                    className="w-6 h-6 mr-3"
                    alt=""
                  />
                  {translation.presale.buysection.buywithbnb}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <BNBWarningModal
        bnbWarningOpen={bnbWarningOpen}
        handleBNBWarningOpen={handleBNBWarningOpen}
        changeNetwork={changeNetwork}
      />

      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  );
};

export default BuySection;
