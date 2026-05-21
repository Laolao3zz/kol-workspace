/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 柔和质感主题色
        // 主背景：温暖的米白；卡片：纯白偏暖；分隔线：雾灰
        canvas: {
          50: '#FBFAF7',  // 主背景
          100: '#F5F3EE', // 区域底
          200: '#EDEAE2', // 分隔
        },
        // 鼠尾草绿（主题色，替换原来的紫蓝渐变）
        sage: {
          50:  '#F1F5F1',
          100: '#E2EBE3',
          200: '#C7D8C9',
          300: '#A4BFA8',
          400: '#80A586',
          500: '#5F8A66',  // 主色
          600: '#4B7152',
          700: '#3C5A42',
          800: '#314634',
          900: '#283A2C',
        },
        // 雾蓝（次要点缀，运输中等中性进行态）
        mist: {
          50:  '#F2F5F7',
          100: '#E3EAEE',
          200: '#C9D5DD',
          300: '#A3B8C5',
          400: '#7E9BAD',
          500: '#5F8095',
          600: '#4B677A',
          700: '#3D5363',
        },
        // 奶油杏（待寄出/暖提示）
        cream: {
          50:  '#FBF6EF',
          100: '#F5EBD8',
          200: '#EAD6B0',
          300: '#DCBC81',
          400: '#C9A05A',
          500: '#B0843E',
        },
        // 玫瑰陶土（异常/紧急，但不刺眼）
        clay: {
          50:  '#F8EFEC',
          100: '#EFD9D2',
          200: '#DDB3A6',
          300: '#C58875',
          400: '#A66653',
          500: '#894C3D',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"PingFang SC"', '"Microsoft YaHei"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(40, 45, 50, 0.04), 0 4px 12px rgba(40, 45, 50, 0.04)',
        card: '0 1px 3px rgba(40, 45, 50, 0.05), 0 8px 24px rgba(40, 45, 50, 0.04)',
      },
    },
  },
  plugins: [],
}
