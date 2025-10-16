<user_request>надо создать сервис формирования отчётов по бензину с возможностью ввода месяца отчёта, года, названия автомобиля, номер автомобиля, средняя стоимость бензина за месяц(из нескольких цен бензина считает среднюю), смешанный расход бензина на 100 км список клиентов на определённый день недели, фамилия сотрудника, место для подписи. Образец в файле экселя. Надо делать точно такое форматирование. количество топлива за день высчитываем по формуле (пробег за день*расход)/100</user_request>

<todo_list>
1. Create fuel report form component with inputs for month, year, car name/number, fuel prices, consumption, clients, and employee name
2. Implement calculation logic for average fuel price and daily fuel consumption using the formula (daily_mileage * consumption) / 100
3. Build report generation component that formats data into Excel-like table layout with proper styling
4. Add export functionality to generate downloadable reports in Excel format
5. Update main page to display the fuel report service interface
</todo_list>