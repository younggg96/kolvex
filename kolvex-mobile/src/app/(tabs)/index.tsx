import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { benchmarks, companyNames, isSymbol, symbols } from "../../lib/models";
import {
  Button,
  Copy,
  Empty,
  Page,
  Search,
  Section,
} from "../../components/UI";
import { QuoteRow } from "../../components/Quotes";
export default function Markets() {
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const filtered = symbols.filter((s) =>
    `${s} ${companyNames[s]}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const target = query.trim().toUpperCase();
  return (
    <Page
      title="行情"
      subtitle="市场脉搏，尽在掌心。"
      onRefresh={() => setRevision((v) => v + 1)}
    >
      <Button onPress={() => router.push("/markets")}>
        市场全景：指数 / 板块 / 风格 / 跨资产
      </Button>
      <Button onPress={() => router.push("/macro")}>宏观指标</Button>
      <Button onPress={() => router.push("/calendar")}>市场日历</Button>
      <Search
        value={query}
        onChange={setQuery}
        onSubmit={() => {
          if (isSymbol(target)) router.push(`/stock/${target}`);
        }}
      />
      {!query && (
        <>
          <Section title="大盘速览" note="美国市场 · ETF 基准 · USD" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ gap: 12 }}
          >
            {benchmarks.map((symbol) => (
              <QuoteRow
                key={symbol}
                symbol={symbol}
                revision={revision}
                compact
              />
            ))}
          </ScrollView>
        </>
      )}
      <Section
        title={query ? "搜索结果" : "市场观察"}
        note="报价来自数据源，可能存在延迟"
      />
      <View style={{ gap: 8 }}>
        {filtered.map((symbol) => (
          <QuoteRow key={symbol} symbol={symbol} revision={revision} />
        ))}
      </View>
      {!!query && !filtered.length && (
        <Empty
          title="列表内没有匹配股票"
          message="输入完整美股代码后，点击下方按钮查看。"
        />
      )}
      {!!query && isSymbol(target) && (
        <Button onPress={() => router.push(`/stock/${target}`)}>
          查看 {target}
        </Button>
      )}
      <Copy size={12} muted>
        研究从事实开始。市场数据与创作者观点不构成投资建议。
      </Copy>
    </Page>
  );
}
