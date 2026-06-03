<?php
// Supabase PostgREST 클라이언트 (cURL 기반)
// 사용 예:
//   $jobs = Supabase::table('jobs')->select('*, author:profiles!author_id(*)')->is('deleted_at', null)->order('created_at', false)->limit(10)->get();

class Supabase
{
    private string $table;
    private string $select = '*';
    private array $filters = [];
    private ?string $orderBy = null;
    private ?int $limitN = null;
    private ?int $offsetN = null;
    private ?string $userToken = null;

    public static function table(string $name): self
    {
        $s = new self();
        $s->table = $name;
        return $s;
    }

    public function withToken(?string $token): self { $this->userToken = $token; return $this; }
    public function select(string $cols): self { $this->select = $cols; return $this; }

    public function eq(string $col, $value): self { return $this->filter($col, 'eq', $value); }
    public function neq(string $col, $value): self { return $this->filter($col, 'neq', $value); }
    public function gt(string $col, $value): self { return $this->filter($col, 'gt', $value); }
    public function gte(string $col, $value): self { return $this->filter($col, 'gte', $value); }
    public function lt(string $col, $value): self { return $this->filter($col, 'lt', $value); }
    public function lte(string $col, $value): self { return $this->filter($col, 'lte', $value); }
    public function like(string $col, $value): self { return $this->filter($col, 'like', $value); }
    public function ilike(string $col, $value): self { return $this->filter($col, 'ilike', $value); }
    public function is(string $col, $value): self {
        $v = $value === null ? 'null' : ($value === true ? 'true' : ($value === false ? 'false' : $value));
        return $this->filter($col, 'is', $v);
    }
    public function in(string $col, array $values): self {
        return $this->filter($col, 'in', '(' . implode(',', array_map('strval', $values)) . ')');
    }

    private function filter(string $col, string $op, $value): self
    {
        $this->filters[] = [$col, $op, $value];
        return $this;
    }

    public function order(string $col, bool $asc = true): self
    {
        $this->orderBy = $col . '.' . ($asc ? 'asc' : 'desc');
        return $this;
    }

    public function limit(int $n): self { $this->limitN = $n; return $this; }
    public function offset(int $n): self { $this->offsetN = $n; return $this; }

    private function buildQuery(): string
    {
        $params = ['select' => $this->select];
        foreach ($this->filters as [$c, $op, $v]) {
            $params[$c] = $op . '.' . (is_array($v) ? implode(',', $v) : (string)$v);
        }
        if ($this->orderBy) $params['order'] = $this->orderBy;
        if ($this->limitN !== null) $params['limit'] = $this->limitN;
        if ($this->offsetN !== null) $params['offset'] = $this->offsetN;
        return http_build_query($params);
    }

    public function get(): array
    {
        $url = SUPABASE_URL . '/rest/v1/' . $this->table . '?' . $this->buildQuery();
        $resp = self::request('GET', $url, null, $this->userToken);
        return is_array($resp) ? $resp : [];
    }

    public function first(): ?array
    {
        $rows = $this->limit(1)->get();
        return $rows[0] ?? null;
    }

    public function count(): int
    {
        $url = SUPABASE_URL . '/rest/v1/' . $this->table . '?' . $this->buildQuery() . '&select=id';
        $headers = self::baseHeaders($this->userToken);
        $headers[] = 'Prefer: count=exact';
        $headers[] = 'Range: 0-0';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_USERAGENT => 'curl/8.4.0',
        ]);
        $raw = curl_exec($ch);
        $hsize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        $header = substr($raw, 0, $hsize);
        if (preg_match('/Content-Range:\s*\d+-\d+\/(\d+)/i', $header, $m)) {
            return (int)$m[1];
        }
        return 0;
    }

    public function insert(array $data, ?string $userToken = null): ?array
    {
        $url = SUPABASE_URL . '/rest/v1/' . $this->table;
        return self::request('POST', $url, $data, $userToken ?? $this->userToken);
    }

    public function update(array $data): array
    {
        $url = SUPABASE_URL . '/rest/v1/' . $this->table . '?' . $this->buildQuery();
        $resp = self::request('PATCH', $url, $data, $this->userToken);
        return is_array($resp) ? $resp : [];
    }

    public static function rpc(string $name, array $params = [], ?string $userToken = null)
    {
        $url = SUPABASE_URL . '/rest/v1/rpc/' . $name;
        return self::request('POST', $url, $params, $userToken);
    }

    private static function baseHeaders(?string $userToken = null): array
    {
        $headers = [
            'apikey: ' . SUPABASE_ANON_KEY,
            'Authorization: Bearer ' . ($userToken ?: SUPABASE_ANON_KEY),
            'Accept-Profile: ' . SUPABASE_SCHEMA,
            'Content-Profile: ' . SUPABASE_SCHEMA,
            'Content-Type: application/json',
            'Prefer: return=representation',
        ];
        return $headers;
    }

    private static function request(string $method, string $url, $body = null, ?string $userToken = null)
    {
        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => self::baseHeaders($userToken),
            CURLOPT_USERAGENT => 'curl/8.4.0',
            CURLOPT_TIMEOUT => 30,
        ];
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
        }
        curl_setopt_array($ch, $opts);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 400) {
            error_log("[Supabase] $method $url → $code: $resp");
            return null;
        }
        return json_decode($resp, true);
    }
}
