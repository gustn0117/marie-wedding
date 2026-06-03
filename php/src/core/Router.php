<?php
// 매우 가벼운 라우터. GET/POST + path param 지원.

class Router
{
    private array $routes = [];

    public function get(string $pattern, callable $handler): void { $this->routes[] = ['GET', $pattern, $handler]; }
    public function post(string $pattern, callable $handler): void { $this->routes[] = ['POST', $pattern, $handler]; }

    public function dispatch(): void
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        foreach ($this->routes as [$m, $pattern, $handler]) {
            if ($m !== $method) continue;
            $regex = '#^' . preg_replace_callback('#\{(\w+)\}#', function ($m) {
                return '(?P<' . $m[1] . '>[^/]+)';
            }, rtrim($pattern, '/')) . '/?$#';
            if (preg_match($regex, rtrim($path, '/'), $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                $handler($params);
                return;
            }
        }

        http_response_code(404);
        View::render('errors/404');
    }
}
