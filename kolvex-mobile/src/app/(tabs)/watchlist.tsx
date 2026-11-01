import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { QuoteRow } from "../../components/Quotes";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Page,
  Skeleton,
} from "../../components/UI";
import { useWatchlist } from "../../state/Watchlist";
export default function Watchlist() {
  const list = useWatchlist();
  const [revision, setRevision] = useState(0);
  return (
    <Page
      title="我的自选"
      subtitle="把值得持续关注的公司，留在这里。"
      onRefresh={() => setRevision((v) => v + 1)}
    >
      {list.error && <Failure message={list.error} />}
      {!list.ready ? (
        <Skeleton />
      ) : !list.symbols.length ? (
        <>
          <Empty
            title="从一家公司开始"
            message="打开股票详情，点击「加入自选」。自选保存在这台设备上。"
          />
          <Button onPress={() => router.navigate("/")}>浏览行情</Button>
        </>
      ) : (
        list.symbols.map((symbol) => (
          <View key={symbol} style={{ gap: 8 }}>
            <QuoteRow symbol={symbol} revision={revision} />
            <Button
              onPress={() => list.toggle(symbol)}
              label={`移除 ${symbol} 自选`}
            >
              移除 {symbol}
            </Button>
          </View>
        ))
      )}
      <Copy size={12} muted>
        本机自选 · 暂不与网页账户同步
      </Copy>
    </Page>
  );
}
