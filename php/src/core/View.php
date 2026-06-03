<?php
// 템플릿 렌더링. layout + content 패턴.

class View
{
    private static array $shared = [];

    public static function share(string $key, $value): void { self::$shared[$key] = $value; }

    public static function render(string $template, array $data = [], bool $useLayout = true): void
    {
        $data = array_merge(self::$shared, $data);
        extract($data, EXTR_SKIP);

        $templatePath = __DIR__ . '/../views/' . $template . '.php';
        if (!file_exists($templatePath)) {
            http_response_code(500);
            echo 'Template not found: ' . htmlspecialchars($template);
            return;
        }

        if (!$useLayout) {
            require $templatePath;
            return;
        }

        ob_start();
        require $templatePath;
        $content = ob_get_clean();

        require __DIR__ . '/../views/layout/header.php';
        echo $content;
        require __DIR__ . '/../views/layout/footer.php';
    }

    public static function e(?string $value): string
    {
        return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    public static function url(string $path): string
    {
        return $path;
    }

    public static function redirect(string $path): void
    {
        header('Location: ' . $path);
        exit;
    }
}
