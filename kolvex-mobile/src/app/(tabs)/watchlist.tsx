import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { QuoteRow } from "../../components/Quotes";
import {
  Button,
  Copy,
  Empty,
  Failure,
  ListPage,
  LoadingStatus,
} from "../../components/UI";
import { useWatchlist } from "../../state/Watchlist";
export default function Watchlist() {
  const list = useWatchlist();
  const [revision, setRevision] = useState(0);
  return (
    <ListPage
      title="我的自选"
      subtitle="把值得持续关注的公司，留在这里。"
      items={list.symbols}
      keyFor={(symbol) => symbol}
      refreshing={list.pending}
      onRefresh={() => {
        list.refresh();
        setRevision((v) => v + 1);
      }}
      header={
        list.error ? (
          <Failure message={list.error} retry={list.refresh} />
        ) : undefined
      }
      empty={
        !list.ready && !list.error ? (
          <LoadingStatus />
        ) : list.error ? undefined : (
          <View style={{ gap: 16 }}>
            <Empty
              title="从一家公司开始"
              message="打开股票详情加入自选，与网页版使用同一份账户列表。"
            />
            <Button onPress={() => router.navigate("/")}>浏览行情</Button>
          </View>
        )
      }
      footer={
        <Copy size={12} muted>
          账户自选 · 下拉刷新获取网页端变化
        </Copy>
      }
      renderItem={(symbol) => (
        <View style={{ gap: 8 }}>
          <QuoteRow symbol={symbol} revision={revision} />
          <Button
            disabled={list.pending}
            onPress={() => list.toggle(symbol)}
            label={`移除 ${symbol} 自选`}
          >
            移除 {symbol}
          </Button>
        </View>
      )}
    />
  );
}
